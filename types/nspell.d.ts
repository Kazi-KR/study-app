// Minimal types for nspell (v2.x). The package ships no .d.ts, and the full
// upstream API is larger than what we actually use in SpellcheckTextarea.
// If we ever need add/personal/wordCharacters/etc., extend this declaration.

declare module "nspell" {
  export interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string, model?: string): NSpell;
    remove(word: string): NSpell;
  }

  export interface Dictionary {
    aff: string | Uint8Array | Buffer;
    dic: string | Uint8Array | Buffer;
  }

  function nspell(dictionary: Dictionary): NSpell;
  function nspell(
    aff: string | Uint8Array | Buffer,
    dic: string | Uint8Array | Buffer,
  ): NSpell;

  export default nspell;
}
