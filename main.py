from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
import joblib
import pandas as pd
import logging
from fastapi.responses import FileResponse
import os

model = joblib.load('fraud_detection_model.joblib')

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

origins = [
    "https://fraud-detection-system-pi.vercel.app",
    "http://localhost",
]



app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

city_code_map = {}
state_code_map = {}

@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join("frontend", "index.html"))

# 2) Mount ONLY the static files
app.mount(
    "/static",
    StaticFiles(directory="frontend"),
    name="static"
)


# Ping endpoint to keep the server active
@app.get("/ping")
async def ping():
    return {"message": "Server is active"}

# Function to read and preprocess the uploaded file
async def read_and_preprocess_file(file: UploadFile):
    global city_code_map, state_code_map

    if file.filename.endswith('.xlsx'):
        df = pd.read_excel(file.file)
    elif file.filename.endswith('.csv'):
        df = pd.read_csv(file.file)
    elif file.filename.endswith('.xls'):
        df = pd.read_excel(file.file)
    else:
        raise ValueError("Unsupported file format")

    # Store trans_date_trans_time temporarily for display
    if 'trans_date_trans_time' in df.columns:
        df['trans_date_trans_time'] = pd.to_datetime(df['trans_date_trans_time'])
        df['temp_trans_date_trans_time'] = df['trans_date_trans_time'].astype(str)  # Keep as string for display
        df['year'] = df['trans_date_trans_time'].dt.year
        df['month'] = df['trans_date_trans_time'].dt.month
        df['day'] = df['trans_date_trans_time'].dt.day
        df['hour'] = df['trans_date_trans_time'].dt.hour
        df['minute'] = df['trans_date_trans_time'].dt.minute
        df['weekday'] = df['trans_date_trans_time'].dt.weekday
        df.drop(columns=['trans_date_trans_time'], inplace=True)

    # Create city and state code maps
    if 'city' in df.columns:
        df['city'] = df['city'].astype('category')
        city_code_map = dict(enumerate(df['city'].cat.categories))
        df['city'] = df['city'].cat.codes

    if 'state' in df.columns:
        df['state'] = df['state'].astype('category')
        state_code_map = dict(enumerate(df['state'].cat.categories))
        df['state'] = df['state'].cat.codes

    # Other preprocessing steps
    if 'category' in df.columns:
        df['category'] = df['category'].astype('category').cat.codes

    return df


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        data = await read_and_preprocess_file(file)
        results = []

        # Check for required columns (modify based on your ML model's features)
        required_columns = ['category', 'amt', 'city', 'state', 'zip', 'lat', 'long', 'unix_time', 'merch_lat',
                            'merch_long', 'year', 'month', 'day', 'hour', 'minute', 'weekday']
        for col in required_columns:
            if col not in data.columns:
                return {"error": f"Missing column in uploaded file: {col}"}

        # Make predictions for each row
        for index, row in data.iterrows():
            features = data[required_columns].iloc[index].values.reshape(1, -1)
            features_df = pd.DataFrame(features, columns=required_columns)
            prediction = model.predict(features_df)

            # Convert city and state codes back to original names
            original_city = city_code_map.get(row['city'], 'Unknown')
            original_state = state_code_map.get(row['state'], 'Unknown')

            results.append({
                "Transaction": index + 1,
                "Transaction Date Time": row.get('temp_trans_date_trans_time', 'N/A'),
                "City": original_city,
                "State": original_state,
                "Amount": row['amt'],
                "Fraud": bool(prediction[0])
            })

        return results
    except Exception as e:
        logger.error("Error occurred: %s", str(e))
        return [{"error": str(e)}]


