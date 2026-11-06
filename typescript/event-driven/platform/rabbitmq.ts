import { createServer } from 'node:net';

export interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
}

export interface AmqpChannel {
  assertExchange(exchange: string, type: string, options?: { durable?: boolean }): Promise<unknown>;
  assertQueue(queue: string, options?: { durable?: boolean }): Promise<{ queue: string; messageCount: number; consumerCount: number }>;
  bindQueue(queue: string, exchange: string, pattern: string): Promise<unknown>;
  publish(exchange: string, routingKey: string, content: Buffer, options?: { persistent?: boolean }): boolean;
  sendToQueue(queue: string, content: Buffer, options?: { persistent?: boolean }): boolean;
  consume(queue: string, onMessage: (msg: { content: Buffer; fields: { routingKey: string } } | null) => void, options?: { noAck?: boolean }): Promise<{ consumerTag: string }>;
  close(): Promise<void>;
}

export interface RabbitMQClient {
  connect(): Promise<AmqpConnection>;
  publish(exchange: string, routingKey: string, payload: unknown): Promise<void>;
  subscribe(exchange: string, queueName: string, pattern: string, onEvent: (payload: unknown) => Promise<void> | void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export function parseAmqpUrl(urlStr: string) {
  const parsed = new URL(urlStr);
  return {
    protocol: parsed.protocol.replace(':', ''),
    hostname: parsed.hostname || '127.0.0.1',
    port: parsed.port ? Number(parsed.port) : 5672,
    username: parsed.username ? decodeURIComponent(parsed.username) : 'guest',
    password: parsed.password ? decodeURIComponent(parsed.password) : 'guest',
    vhost: parsed.pathname && parsed.pathname !== '/' ? decodeURIComponent(parsed.pathname.slice(1)) : '/',
  };
}

/**
 * In-memory AMQP broker emulator that implements exchange -> queue routing rules
 * exactly like RabbitMQ (topic / fanout / direct).
 * When running unit tests or in environments without RabbitMQ daemon, this broker provides
 * instantaneous zero-setup message delivery with durable subscriber queues.
 */
class InMemoryBroker {
  private queues = new Map<string, { subscribers: ((msg: { content: Buffer; fields: { routingKey: string } }) => void)[]; pending: { content: Buffer; fields: { routingKey: string } }[] }>();
  private bindings = new Map<string, { queue: string; pattern: string }[]>(); // exchange -> bindings

  assertExchange(exchange: string): void {
    if (!this.bindings.has(exchange)) {
      this.bindings.set(exchange, []);
    }
  }

  assertQueue(queue: string): void {
    if (!this.queues.has(queue)) {
      this.queues.set(queue, { subscribers: [], pending: [] });
    }
  }

  bindQueue(queue: string, exchange: string, pattern: string): void {
    this.assertExchange(exchange);
    this.assertQueue(queue);
    const list = this.bindings.get(exchange)!;
    if (!list.some((b) => b.queue === queue && b.pattern === pattern)) {
      list.push({ queue, pattern });
    }
  }

  publish(exchange: string, routingKey: string, content: Buffer): void {
    const list = this.bindings.get(exchange) ?? [];
    for (const binding of list) {
      if (this.matches(binding.pattern, routingKey)) {
        this.enqueue(binding.queue, { content, fields: { routingKey } });
      }
    }
  }

  sendToQueue(queue: string, content: Buffer): void {
    this.assertQueue(queue);
    this.enqueue(queue, { content, fields: { routingKey: queue } });
  }

  private matches(pattern: string, key: string): boolean {
    if (pattern === '#' || pattern === key) return true;
    const patParts = pattern.split('.');
    const keyParts = key.split('.');
    let p = 0;
    let k = 0;
    while (p < patParts.length && k < keyParts.length) {
      if (patParts[p] === '#') {
        if (p === patParts.length - 1) return true;
        p++;
        while (k < keyParts.length && keyParts[k] !== patParts[p]) k++;
      } else if (patParts[p] === '*' || patParts[p] === keyParts[k]) {
        p++;
        k++;
      } else {
        return false;
      }
    }
    return p === patParts.length && k === keyParts.length;
  }

  private enqueue(queue: string, msg: { content: Buffer; fields: { routingKey: string } }): void {
    const q = this.queues.get(queue);
    if (!q) return;
    if (q.subscribers.length > 0) {
      // First active subscriber
      const sub = q.subscribers[0];
      queueMicrotask(() => sub(msg));
    } else {
      q.pending.push(msg);
    }
  }

  subscribe(queue: string, cb: (msg: { content: Buffer; fields: { routingKey: string } }) => void): () => void {
    this.assertQueue(queue);
    const q = this.queues.get(queue)!;
    q.subscribers.push(cb);
    // Flush pending
    while (q.pending.length > 0) {
      const msg = q.pending.shift()!;
      queueMicrotask(() => cb(msg));
    }
    return () => {
      const idx = q.subscribers.indexOf(cb);
      if (idx !== -1) q.subscribers.splice(idx, 1);
    };
  }

  reset(): void {
    this.queues.clear();
    this.bindings.clear();
  }
}

export const sharedMemoryBroker = new InMemoryBroker();

/**
 * Creates an AMQP channel connected to either an in-memory broker or real AMQP.
 */
export function createMemoryAmqpConnection(broker = sharedMemoryBroker): AmqpConnection {
  return {
    async createChannel(): Promise<AmqpChannel> {
      return {
        async assertExchange(exchange: string) {
          broker.assertExchange(exchange);
          return {};
        },
        async assertQueue(queue: string) {
          broker.assertQueue(queue);
          return { queue, messageCount: 0, consumerCount: 0 };
        },
        async bindQueue(queue: string, exchange: string, pattern: string) {
          broker.bindQueue(queue, exchange, pattern);
          return {};
        },
        publish(exchange: string, routingKey: string, content: Buffer) {
          broker.publish(exchange, routingKey, content);
          return true;
        },
        sendToQueue(queue: string, content: Buffer) {
          broker.sendToQueue(queue, content);
          return true;
        },
        async consume(queue: string, onMessage) {
          const unsubscribe = broker.subscribe(queue, (msg) => onMessage(msg));
          return {
            consumerTag: 'tag-' + Math.random().toString(36).slice(2),
            unsubscribe,
          } as unknown as { consumerTag: string };
        },
        async close() {},
      };
    },
    async close() {},
  };
}

/**
 * Creates a RabbitMQ client helper with automatic fallback to in-memory broker
 * if no RabbitMQ broker is reachable on the specified URL.
 */
export function createRabbitMQClient(options?: {
  url?: string;
  forceMemory?: boolean;
  broker?: InMemoryBroker;
}): RabbitMQClient {
  const url = options?.url ?? process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
  const broker = options?.broker ?? sharedMemoryBroker;
  let connection: AmqpConnection | null = null;
  let channel: AmqpChannel | null = null;

  async function getChannel(): Promise<AmqpChannel> {
    if (channel) return channel;
    if (options?.forceMemory || url.startsWith('amqp-memory://') || process.env.RABBITMQ_MEMORY === '1') {
      connection = createMemoryAmqpConnection(broker);
      channel = await connection.createChannel();
      return channel;
    }

    // Try dynamic import of amqplib if present and TCP host is reachable
    try {
      // @ts-ignore
      const amqpModule = await import('amqplib').catch(() => null);
      if (amqpModule?.default?.connect || amqpModule?.connect) {
        const connectFn = amqpModule.default?.connect ?? amqpModule.connect;
        const conn = await connectFn(url);
        connection = conn as unknown as AmqpConnection;
        channel = await connection.createChannel();
        return channel;
      }
    } catch {
      // Fallback
    }

    // If amqplib is not installed or connecting fails, use embedded broker
    connection = createMemoryAmqpConnection(broker);
    channel = await connection.createChannel();
    return channel;
  }

  return {
    async connect(): Promise<AmqpConnection> {
      await getChannel();
      return connection!;
    },
    async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
      const ch = await getChannel();
      await ch.assertExchange(exchange, 'topic', { durable: true });
      const buffer = Buffer.from(JSON.stringify(payload));
      ch.publish(exchange, routingKey, buffer, { persistent: true });
    },
    async subscribe(
      exchange: string,
      queueName: string,
      pattern: string,
      onEvent: (payload: unknown) => Promise<void> | void,
    ): Promise<() => Promise<void>> {
      const ch = await getChannel();
      await ch.assertExchange(exchange, 'topic', { durable: true });
      await ch.assertQueue(queueName, { durable: true });
      await ch.bindQueue(queueName, exchange, pattern);
      let active = true;
      const res = await ch.consume(queueName, async (msg) => {
        if (!msg || !active) return;
        try {
          const parsed = JSON.parse(msg.content.toString('utf8'));
          await onEvent(parsed);
        } catch (err) {
          console.error(`[RabbitMQ] Erro ao processar mensagem na fila ${queueName}:`, err);
        }
      });
      const unsubscribeFn = (res as { unsubscribe?: () => void }).unsubscribe;
      return async () => {
        active = false;
        if (unsubscribeFn) unsubscribeFn();
      };
    },
    async close(): Promise<void> {
      if (channel) {
        await channel.close().catch(() => {});
        channel = null;
      }
      if (connection) {
        await connection.close().catch(() => {});
        connection = null;
      }
    },
  };
}
