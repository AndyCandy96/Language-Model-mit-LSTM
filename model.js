export const createModel = (vocabSize) => {
  const model = tf.sequential();

  // 1. LSTM-Schicht
  model.add(tf.layers.lstm({
    units: 100,
    inputShape: [5, 1],  // Hier explizit auf [sequenceLength, 1] setzen
    returnSequences: true,
  }));

  // 2. LSTM-Schicht
  model.add(tf.layers.lstm({
    units: 100,
    returnSequences: false,
  }));

  // Softmax-Ausgabe
  model.add(tf.layers.dense({
    units: vocabSize,
    activation: 'softmax',
  }));

  model.compile({
    optimizer: tf.train.adam(0.002),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
};



