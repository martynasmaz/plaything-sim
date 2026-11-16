// Retain old diagnostic code as evidence, but never let it produce new evidence
// against a different simulation/UI by accident.
export function archivedCheck(url,replacement){
  throw Error(`${new URL(url).pathname.split('/').at(-1)} is archived and incompatible with the current playable game. ${replacement} Historical code and reports remain available for reference.`);
}
