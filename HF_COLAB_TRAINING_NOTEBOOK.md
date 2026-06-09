# Colab Training Notebook

Copy the cells below into Google Colab.

## 1. Install dependencies

```python
!pip -q install transformers datasets accelerate evaluate scikit-learn huggingface_hub pandas seaborn matplotlib gradio
```

## 2. Mount data and load CSV

```python
from google.colab import drive
drive.mount('/content/drive')

import pandas as pd
df = pd.read_csv('/content/drive/MyDrive/train.csv')
df = df[['text', 'label']].dropna()
df.head()
```

## 3. Labels

```python
LABELS = [
    'medical emergency',
    'fire rescue emergency',
    'police security emergency',
    'natural disaster',
    'lost property non emergency',
]
```

## 4. Text augmentation

Use light augmentation only. Keep the original meaning intact.

```python
def augment_text(text, label):
    variants = [text]
    if label == 'medical emergency':
        variants += [
            text.replace('person', 'victim'),
            text.replace('patient', 'victim')
        ]
    elif label == 'fire rescue emergency':
        variants += [
            text.replace('fire', 'smoke and fire'),
            text.replace('smoke', 'thick smoke')
        ]
    elif label == 'police security emergency':
        variants += [
            text.replace('armed', 'weaponized'),
            text.replace('robbery', 'theft')
        ]
    elif label == 'natural disaster':
        variants += [
            text.replace('road', 'main road'),
            text.replace('houses', 'homes')
        ]
    elif label == 'lost property non emergency':
        variants += [
            text.replace('lost', 'missing'),
            text.replace('help find it', 'help locate it')
        ]
    return list(dict.fromkeys([v for v in variants if isinstance(v, str) and v.strip()]))

augmented_rows = []
for _, row in df.iterrows():
    for variant in augment_text(row['text'], row['label']):
        augmented_rows.append({'text': variant, 'label': row['label']})

df = pd.DataFrame(augmented_rows).drop_duplicates(subset=['text', 'label']).reset_index(drop=True)
df.head()
```

## 5. Train / eval split

```python
import numpy as np
from sklearn.model_selection import train_test_split
from datasets import Dataset, DatasetDict

label2id = {label: i for i, label in enumerate(LABELS)}
id2label = {i: label for label, i in label2id.items()}

df = df[df['label'].isin(LABELS)].copy()
df['label_id'] = df['label'].map(label2id)

train_df, eval_df = train_test_split(
    df,
    test_size=0.2,
    random_state=42,
    stratify=df['label_id']
)

dataset = DatasetDict({
    'train': Dataset.from_pandas(train_df[['text', 'label_id']].rename(columns={'label_id': 'labels'}), preserve_index=False),
    'validation': Dataset.from_pandas(eval_df[['text', 'label_id']].rename(columns={'label_id': 'labels'}), preserve_index=False)
})
```

## 6. Tokenizer and model

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_NAME = 'xlm-roberta-base'
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize(batch):
    return tokenizer(batch['text'], truncation=True)

dataset = dataset.map(tokenize, batched=True)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(LABELS),
    id2label=id2label,
    label2id=label2id
)
```

## 7. Metrics, confusion matrix, and training

```python
from transformers import TrainingArguments, Trainer, DataCollatorWithPadding
from evaluate import load as load_metric
from sklearn.metrics import confusion_matrix, classification_report
import seaborn as sns
import matplotlib.pyplot as plt

data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
accuracy = load_metric('accuracy')
f1 = load_metric('f1')

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        'accuracy': accuracy.compute(predictions=predictions, references=labels)['accuracy'],
        'f1': f1.compute(predictions=predictions, references=labels, average='weighted')['f1']
    }

training_args = TrainingArguments(
    output_dir='/content/emergency-nlp-model',
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    num_train_epochs=4,
    weight_decay=0.01,
    evaluation_strategy='epoch',
    save_strategy='epoch',
    load_best_model_at_end=True,
    metric_for_best_model='f1',
    save_total_limit=2,
    logging_steps=20,
    report_to='none'
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset['train'],
    eval_dataset=dataset['validation'],
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics
)

trainer.train()
eval_results = trainer.evaluate()
print(eval_results)

predictions = trainer.predict(dataset['validation'])
pred_ids = np.argmax(predictions.predictions, axis=-1)
true_ids = predictions.label_ids

cm = confusion_matrix(true_ids, pred_ids)
plt.figure(figsize=(10, 8))
sns.heatmap(cm, annot=True, fmt='d', xticklabels=LABELS, yticklabels=LABELS, cmap='Blues')
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('Confusion Matrix')
plt.xticks(rotation=45, ha='right')
plt.yticks(rotation=0)
plt.show()

print(classification_report(true_ids, pred_ids, target_names=LABELS))
```

## 8. Save and upload

```python
trainer.save_model('/content/emergency-nlp-model/final')
tokenizer.save_pretrained('/content/emergency-nlp-model/final')

from huggingface_hub import login
login()

model.push_to_hub('your-hf-username/emergency-nlp-model')
tokenizer.push_to_hub('your-hf-username/emergency-nlp-model')
```

## 9. Export inference pipeline

This gives you a simple inference function that can be hosted in Hugging Face Spaces or wrapped in an API.

```python
from transformers import pipeline

classifier = pipeline(
    'text-classification',
    model='/content/emergency-nlp-model/final',
    tokenizer='/content/emergency-nlp-model/final',
    return_all_scores=True,
    truncation=True
)

def classify_emergency(text):
    output = classifier(text)[0]
    output = sorted(output, key=lambda item: item['score'], reverse=True)
    return {
        'labels': [item['label'] for item in output],
        'scores': [float(item['score']) for item in output]
    }

print(classify_emergency('Smoke coming from the building and people are trapped'))
```

To deploy as a small API in Spaces, create an `app.py` with Gradio:

```python
import gradio as gr

def predict(text):
    result = classify_emergency(text)
    return result['labels'][0], result['scores'][0]

demo = gr.Interface(
    fn=predict,
    inputs=gr.Textbox(lines=3, label='Emergency text'),
    outputs=[gr.Textbox(label='Top label'), gr.Number(label='Confidence')],
    title='Emergency NLP Classifier'
)

demo.launch()
```

## 10. Use in the app

Set `HUGGINGFACE_API_KEY` and `HF_NLP_MODEL=your-hf-username/emergency-nlp-model` on Vercel.

The app will then call your fine-tuned model from `api/nlp.ts`.
