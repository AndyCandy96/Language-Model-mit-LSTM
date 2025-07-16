// Funktion zur Entfernung von HTML-Tags
function removeHTMLTags(text) {
    if (!text) return ""; // Falls der Text leer oder undefined ist, gib einen leeren String zurück
    return text.replace(/<\/?[^>]+(>|$)/g, "").trim(); // Entfernt HTML-Tags
}

// Funktion zur Vorverarbeitung des Textes
export const preprocessText = (text) => {
    if (!text) return []; // Falls der Text leer oder undefined ist, gib ein leeres Array zurück

    // Wandelt in Kleinbuchstaben um und entfernt HTML-Tags
    text = text.toLowerCase(); 
    text = removeHTMLTags(text); 

    // Entfernt alle Sonderzeichen und Zahlen (lässt nur Buchstaben und Leerzeichen übrig)
    text = text.replace(/[^a-zA-ZäöüßÄÖÜ\s]/g, ''); 

    const tokens = text.split(/\s+/); // Zerlegt in Tokens (Wörter)
    return tokens;
};



// Funktion zum Erstellen des Vokabulars (Wörter und deren IDs)
export const createVocabulary = (articles) => {
    const vocab = new Set();

    articles.forEach(article => {
        // Überprüfen, ob der Body des Artikels existiert und nicht leer ist
        if (article.Body) {
            const tokens = preprocessText(article.Body); // Vorverarbeite Text
            tokens.forEach(token => vocab.add(token)); // Füge Tokens zum Set hinzu
        }
    });

    const wordToId = Array.from(vocab).reduce((acc, word, idx) => {
        acc[word] = idx; // Weise jedem Wort eine ID zu
        return acc;
    }, {});

    return wordToId;
};

export const createSequences = (articles, sequenceLength, wordToId) => {
    const sequences = [];

    articles.forEach(article => {
        // Überprüfen, ob der Body des Artikels existiert und nicht leer ist
        if (article.Body) {
            const tokens = preprocessText(article.Body); // Vorverarbeite Text
            for (let i = 0; i < tokens.length - sequenceLength; i++) {
                const sequence = tokens.slice(i, i + sequenceLength); // Eingabesequenz
                const target = tokens[i + sequenceLength]; // Zielwort
                const inputIds = sequence.map(word => wordToId[word]); // Konvertiere Wörter in IDs
                const targetId = wordToId[target]; // Konvertiere Zielwort in ID
                sequences.push({ input: inputIds, target: targetId });
            }
        }
    });

    return sequences;
};

// Lade Artikel aus der CSV
Papa.parse('./Articles.csv', {
  download: true,
  header: true,
  complete: function(results) {
    // Verarbeite alle Artikel, aber gib nur die ersten 10 zur Überprüfung aus
    const allArticles = results.data;
    const firstTenArticles = allArticles.slice(0, 10); // Nur die ersten 10 Artikel zur Ausgabe

    // Erstelle das Vokabular aus allen Artikeln
    const wordToId = createVocabulary(allArticles);

    // Erstelle die Sequenzen mit einer Sequenzlänge von 5 aus allen Artikeln
    const sequences = createSequences(allArticles, 5, wordToId);

  }
});
