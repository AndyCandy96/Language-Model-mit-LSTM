import { createModel } from './model.js';
import { createVocabulary, createSequences, preprocessText } from './data_preprocessing.js';

// Beispielhafte Vokabulargröße und Sequenzlänge
const vocabSize = 5000;  // Dies wird dynamisch aus dem Vokabular berechnet
const sequenceLength = 5;

let model;
let wordToId, idToWord;
let currentText = "";
let currentPrediction = [];

// Funktion zur Vorverarbeitung und Generierung von Trainingsdaten
const createTrainingData = (articles, sequenceLength, wordToId, vocabSize) => {
  const xTrain = [];
  const yTrain = [];

  const sequences = createSequences(articles, sequenceLength, wordToId);
  
  console.log("Anzahl der Sequenzen:", sequences.length);

  // Teste nur mit den ersten 100 Sequenzen
  const limitedSequences = sequences.slice(0, 100);
  console.log("Verwendete Sequenzen (erste 100):", limitedSequences);

  limitedSequences.forEach(seq => {
    xTrain.push(seq.input.map(value => [value]));  
    
    const target = new Array(vocabSize).fill(0);  // One-Hot-Encoding-Array
    target[seq.target] = 1;  // Setze den Wert an der Position des Zielworts auf 1
    yTrain.push(target);  // Füge das One-Hot-Encoding zum yTrain hinzu
  });

  if (xTrain.length === 0 || yTrain.length === 0) {
    console.error("Fehler: xTrain oder yTrain sind leer!");
    return { xTensor: null, yTensor: null };
  }

  // Tensoren erstellen
  try {
    const xTensor = tf.tensor3d(xTrain, [xTrain.length, sequenceLength, 1]);
    const yTensor = tf.tensor2d(yTrain, [yTrain.length, vocabSize]);
    console.log("xTensor Form:", xTensor.shape);
    console.log("yTensor Form:", yTensor.shape);
    return { xTensor, yTensor };
  } catch (error) {
    console.error("Fehler bei der Erstellung der Tensoren:", error);
    return { xTensor: null, yTensor: null };
  }
};

// Vorhersagefunktion
const predictNextWord = async (inputText) => {
  const preprocessedText = preprocessText(inputText);
  console.log("Preprocessed Text:", preprocessedText);

  let inputSequence = preprocessedText.map(word => wordToId[word] || 0);
  console.log("Mapped inputSequence:", inputSequence);

  while (inputSequence.length < sequenceLength) {
    inputSequence.unshift(0); // Auffüllen der Sequenz, wenn sie kürzer ist
  }

  if (inputSequence.length > sequenceLength) {
    inputSequence = inputSequence.slice(-sequenceLength); // Auf die Länge der Sequenz kürzen
  }

  let inputTensor = tf.tensor3d([inputSequence.map(item => [item])], [1, sequenceLength, 1]);

  const prediction = model.predict(inputTensor);
  const predictedIndex = prediction.argMax(-1).dataSync()[0];

  const predictedWord = idToWord[predictedIndex] || "undefined";
  console.log("Vorhergesagtes Wort:", predictedWord);

  return predictedIndex;
};

// Lade Artikel aus der CSV und erstelle Trainingsdaten
Papa.parse('./Articles.csv', {
  download: true,
  header: true,
  complete: function(results) {
    const allArticles = results.data;
    console.log("Beispielhafte Artikel (erste 10):", allArticles.slice(0, 600));

    wordToId = createVocabulary(allArticles);
    console.log("Vokabular:", wordToId);

    idToWord = Object.keys(wordToId).reduce((acc, word) => {
      acc[wordToId[word]] = word;
      return acc;
    }, {});

    const { xTensor, yTensor } = createTrainingData(allArticles, sequenceLength, wordToId, vocabSize);

    if (!xTensor || !yTensor) {
      console.error("Fehler: Tensoren konnten nicht erstellt werden.");
      return;
    }

    const trainModel = async () => {
      model = createModel(vocabSize);

      try {
        await model.fit(xTensor, yTensor, {
          epochs: 1000,
          batchSize: 16,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              console.log(`Epoch ${epoch}: loss = ${logs.loss}, acc = ${logs.acc}`);
            }
          }
        });

        await model.save('localstorage://my-language-model');
        console.log("Modell erfolgreich trainiert und gespeichert!");
        // Jetzt generiere Text mit dem Modell
        const seedText = "Dies ist ein Test";  // Beispieltext für den Start
        generateText(model, seedText, sequenceLength, wordToId, idToWord, 50);
      } catch (error) {
        console.error("Fehler beim Modelltraining:", error);
      }
    };

    trainModel();
  }
});

// Vorhersage Button
document.getElementById('predictButton')?.addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;
  const predictedIndex = await predictNextWord(inputText);
  if (predictedIndex === undefined) return;
  const predictedWord = idToWord[predictedIndex];
  const predictionsList = document.getElementById('predictionsList');
  predictionsList.innerHTML = `<li>${predictedWord}</li>`;
  currentPrediction = [predictedWord];
});

// Weiter Button
document.getElementById('continueButton')?.addEventListener('click', async () => {
  if (currentPrediction.length > 0) {
    const predictedWord = currentPrediction[0];

    // Hole den aktuellen Text aus dem Textfeld und füge das vorgeschlagene Wort hinzu
    const inputField = document.getElementById('inputText');
    currentText = inputField.value;  // Der vorherige Text im Textfeld
    currentText += ' ' + predictedWord;  // Füge das neue Wort an

    // Setze den aktualisierten Text wieder ins Textfeld
    inputField.value = currentText;

    // Hole die nächste Vorhersage
    const predictedIndex = await predictNextWord(currentText);
    const nextWord = idToWord[predictedIndex];
    currentPrediction = [nextWord];

    // Zeige die Vorhersage in der Liste an
    const predictionsList = document.getElementById('predictionsList');
    predictionsList.innerHTML = `<li>${nextWord}</li>`;
  }
});


// Auto Button
let autoGenerationInProgress = false; // Flag, um den automatischen Vorgang zu steuern
let autoText = ''; // Hier wird der Text zwischengespeichert

// Auto Button
document.getElementById('autoButton')?.addEventListener('click', async () => {
  if (autoGenerationInProgress) {
    console.log('Automatische Vorhersage läuft bereits...');
    return;  // Verhindert das Starten einer neuen Vorhersage, wenn bereits eine läuft
  }

  autoText = currentText; // Beginnt mit dem aktuellen Text

  autoGenerationInProgress = true;  // Markiere den Start der automatischen Vorhersage
  let generatedWordsCount = 0;

  for (let i = 0; i < 10; i++) {
    const predictedIndex = await predictNextWord(autoText); // Vorhersage des nächsten Wortes
    if (predictedIndex === undefined) break;  // Wenn keine Vorhersage möglich, abbrechen

    const nextWord = idToWord[predictedIndex];
    autoText += ' ' + nextWord;  // Füge das Vorhersagewort zum Text hinzu
    generatedWordsCount++;

    document.getElementById('inputText').value = autoText;  // Aktualisiere das Textfeld mit dem neuen Text

    if (generatedWordsCount >= 10) break;  // Stoppe nach maximal 10 generierten Wörtern
  }

  autoGenerationInProgress = false;  // Automatische Vorhersage ist abgeschlossen
});

// Stop Button
document.getElementById('stopButton')?.addEventListener('click', () => {
  autoGenerationInProgress = false;  // Stoppe die automatische Vorhersage
  console.log('Automatische Vorhersage gestoppt');
});


// Reset Button
document.getElementById('resetButton')?.addEventListener('click', () => {
  document.getElementById('inputText').value = '';
  currentText = '';
  currentPrediction = [];
  console.log('Text und Modell zurückgesetzt');
});


const sample = (prediction, temperature = 0.9) => {
    const logits = prediction.dataSync();
    const expValues = logits.map(value => Math.exp(value / temperature));
    const sum = expValues.reduce((a, b) => a + b, 0);
    const probs = expValues.map(value => value / sum);
    const rand = Math.random();
    let cumulativeProbability = 0;
    for (let i = 0; i < probs.length; i++) {
        cumulativeProbability += probs[i];
        if (rand < cumulativeProbability) {
            return i;
        }
    }
    return probs.length - 1; // Fallback
};

const topKSampling = (prediction, k) => {
    const logits = prediction.dataSync();
    // Holen der Top-K-Wahrscheinlichkeiten
    const topKValues = Array.from(logits)
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .slice(0, k); // Top-K-Werte

    // Erstellen der Wahrscheinlichkeiten für die Auswahl
    const sum = topKValues.reduce((acc, item) => acc + item.value, 0);
    const probs = topKValues.map(item => item.value / sum);

    // Zufällige Auswahl basierend auf den Top-K-Wahrscheinlichkeiten
    let cumulativeProbability = 0;
    const rand = Math.random();
    for (let i = 0; i < probs.length; i++) {
        cumulativeProbability += probs[i];
        if (rand < cumulativeProbability) {
            return topKValues[i].index;
        }
    }
    return topKValues[topKValues.length - 1].index;
};

const topPSampling = (prediction, p) => {
    const logits = prediction.dataSync();
    const sortedValues = Array.from(logits)
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value); // Sortiere nach Wahrscheinlichkeit

    let cumulativeProbability = 0;
    let topP = [];
    for (let i = 0; i < sortedValues.length; i++) {
        cumulativeProbability += sortedValues[i].value;
        topP.push(sortedValues[i]);
        if (cumulativeProbability >= p) {
            break;
        }
    }

    // Zufällige Auswahl aus den Top-P-Wörtern
    const sum = topP.reduce((acc, item) => acc + item.value, 0);
    const probs = topP.map(item => item.value / sum);

    let rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
        cumulative += probs[i];
        if (rand < cumulative) {
            return topP[i].index;
        }
    }
    return topP[topP.length - 1].index;
};

const generateText = async (model, seedText, sequenceLength, wordToId, idToWord, numWords = 50, temperature = 0.7, samplingMethod = "top-p") => {
    let inputSequence = preprocessText(seedText).map(word => wordToId[word] || 0);  
    let generatedText = seedText;

    for (let i = 0; i < numWords; i++) {
        while (inputSequence.length < sequenceLength) {
            inputSequence.unshift(0);
        }

        const inputTensor = tf.tensor3d([inputSequence.slice(-sequenceLength).map(x => [x])], [1, sequenceLength, 1]);

        const prediction = model.predict(inputTensor);

        let predictedIndex;
        if (samplingMethod === "top-k") {
            predictedIndex = topKSampling(prediction, 40); // Use Top-K Sampling
        } else if (samplingMethod === "top-p") {
            predictedIndex = topPSampling(prediction, 0.9); // Use Top-P Sampling
        } else {
            predictedIndex = sample(prediction, temperature);  // Default
        }

        const predictedWord = idToWord[predictedIndex];
        generatedText += ' ' + predictedWord;

        inputSequence.push(predictedIndex);
    }

    console.log("Generated Text:", generatedText);
};









