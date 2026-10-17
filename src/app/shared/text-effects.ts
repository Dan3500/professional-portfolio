// Utilidades para los textos con ola de color (ver .wave-title y el nombre de
// la portada en styles.scss).

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);

// Una span por letra con su posición en --i, agrupadas por palabras
// (.wave-word, que no se parte: si no, la línea podía cortarse entre dos
// letras cualesquiera). Los espacios quedan como texto entre palabras. La ola
// avanza en el sentido en que crece --i: con reverse se numeran de derecha a
// izquierda, sobre `length` posiciones (el nombre de la portada se numera
// sobre el texto completo aunque aún no esté escrito entero). `trailing` (HTML)
// se añade dentro de la última palabra, pegado a su última letra: es donde va
// el cursor de la escritura.
export function waveChars(text: string, reverse: boolean, length = [...text].length, trailing = ''): string {
  const words = text.split(' ');
  let position = 0;
  return words
    .map((word, w) => {
      const letters = [...word]
        .map((char) => {
          const index = reverse ? length - 1 - position : position;
          position++;
          return `<span class="wave-char" aria-hidden="true" style="--i:${index}">${escapeHtml(char)}</span>`;
        })
        .join('');
      position++; // el espacio también cuenta como posición
      return `<span class="wave-word">${letters}${w === words.length - 1 ? trailing : ''}</span>`;
    })
    .join(' ');
}
