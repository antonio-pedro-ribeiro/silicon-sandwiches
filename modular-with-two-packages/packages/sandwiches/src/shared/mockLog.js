// Registo das chamadas aos mocks, para se ver na consola durante a aula.
// Fica em silêncio se SILENT estiver definido (por exemplo, nos testes).
export function mockLog(component, message) {
  if (!process.env.SILENT) console.log(`  [${component} · mock] ${message}`);
}
