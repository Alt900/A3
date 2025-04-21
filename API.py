
import os
import json

import threading
from flask import Flask,request, Response
from flask_socketio import SocketIO

from PyPredict import ML,API_Interface,np, filesystem
from datetime import datetime, timedelta
#CPython
from CPy_Lib import ReadJSON, CStats, Normalization


app_dir = os.getcwd()
app=Flask(__name__)
SocketIO_Reference = SocketIO(app, cors_allowed_origins="*")
Threading_Reference = threading.Event()

#load whats already downloaded
DH_Object = API_Interface.DataHandler()
DH_Object.DownloadTickerData(
    DH_Object.OnHand,
    None,
    None,
    None,
    False
)

LiveStopSignal = threading.Event()

metrics_dispatcher = {
    "Mean": CStats.Mean,
    "Mode": CStats.Mode,
    "Median": CStats.Median,
    "Variance": CStats.Variance,
    "STD": CStats.STD,
    "EMA": CStats.EMA,
    "ATR": CStats.ATR,
    "AMA": CStats.AMA
}

#an exception for min max and z score has to be made,
#if min max is called Normalization.FindMinMax has to be called
#if z score is called CStats.Mean and Cstats.STD has to be called

normalization_dispatcher = {
    "Logarithmic":Normalization.Logarithmic,
    "MinMax":Normalization.MinMax,
    "Z_Score":Normalization.Z_Score
}

denormalization_dispatcher = {
    "Logarithmic":Normalization.Logarithmic_Denorm,
    "MinMax":Normalization.MinMax_Denorm,
    "Z_Score":Normalization.Z_Score_Denorm
}

@app.route("/api/GetTickers")
def GetTickers():
    DataDirectory=os.getcwd()+f"{filesystem}MarketData"
    Tickers = []
    for filename in [x for x in os.walk(DataDirectory)][0][2]:
        Tickers.append(filename.split("_")[0])
    return{
        "payload":Tickers,
        "error": None
    }

@app.route("/api/DownloadData")
def DownloadData():
    DH_Object.DownloadTickerData(
        [x.replace(" ","") for x in request.args.get("Tickers").split(',')],
        request.args.get("from",type=str).replace(",","-"),
        request.args.get("to",type=str).replace(",","-"),
        request.args.get("interval",type=str),
        request.args.get("overwrite",type=bool)
    )
    return {
        "payload": "Download complete",
        "error": None
    } 

@app.route("/GetNews")
def GetNews():
    Obj = API_Interface.DataHandler()
    tickers = [x.replace(" ","") for x in request.args.get("Tickers").split(',')]
    Articles = []
    for ticker in Obj.GetArticles(tickers):
        Articles.append(ticker["news"])

    return {
        "payload":Articles,
        "error":None
    }

@app.route("/api/FetchJSON",methods=['GET'])
def FetchJSON():
    ticker = f"./MarketData/{request.args.get('ticker')}_data.json"
    JSON_String = ReadJSON.Fetch(ticker)
    Marshalled=json.loads(JSON_String)

    return{ 
        "payload":Marshalled,
        "error":None
    }

@app.route("/LiveStockFeed")
def LiveStockFeed():
    Ticker = request.args.get("ticker",type=str)
    def Stream():
        while not LiveStopSignal.is_set():
            Data = DH_Object.GetCurrentPrice(Ticker)
            yield {
                "payload": Data,
                "error": None
            }
        yield {
            "payload":"Stopped live stock stream",
            "error":None
        }

    return Response(Stream(),content_type='text/event-stream')

@app.route("/LiveFeedSignal",methods=['POST'])
def LiveFeedSignal():
    LiveStopSignal.set()
    return{
        "payload":f"Set live feed signal to {LiveStopSignal}",
        "error":None
    }

@app.route("/api/CreateModel")
def CreateCustomModel():
    Hyperparameters = json.loads(request.args.get("Hyperparams"))
    Layer_Arguments = json.loads(request.args.get("LayerArgs"))
    Norm_Method = Hyperparameters["normalization"]
    Ticker = Hyperparameters["ticker"]
    Variables = Hyperparameters["variables"]
    VariablesTimeStamp = Variables+["timestamp"]
    var_count = len(Variables)

    Model_Obj = ML.Customized_Network(Layer_Arguments,Variables,Hyperparameters["batch_size"])
    copy = API_Interface.data[Ticker][VariablesTimeStamp].copy()
    Means,STDs,Min,Max=[],[],[],[]
    TTV = [Hyperparameters["train_ratio"],Hyperparameters["test_ratio"],Hyperparameters["validation_ratio"]]

    to_export = json.loads(API_Interface.data[Ticker][VariablesTimeStamp].copy().to_json(orient="records"))

    #Normalize organic data before generating synthetic timestamps
    if Norm_Method=="Z_Score":
        for column in Variables:
            listcol = list(copy[column].tolist())
            Mean = CStats.Mean(listcol)
            STD = CStats.STD(Mean,listcol)
            Means.append(Mean)
            STDs.append(STD)
            copy[column] = normalization_dispatcher[Norm_Method](listcol,Mean,STD)
    
    elif Norm_Method=="MinMax":
        for column in Variables:
            listcol = list(copy[column].tolist())
            tempmin = min(listcol)
            tempmax = max(listcol)
            Min.append(tempmin)
            Max.append(tempmax)
            copy[column] = normalization_dispatcher[Norm_Method](listcol,tempmin,tempmax)
    
    else:
        for column in Variables:
            copy[column] = normalization_dispatcher[Norm_Method](list(copy[column].tolist()))
    
    normdenorm_arg_dispatcher = {
        "Logarithmic":lambda array,_:[array],
        "MinMax":lambda array,i:[array,Min[i],Max[i]],
        "Z_Score":lambda array,i:[array,Means[i],STDs[i]],
    }
    
    MVR = ML.Window(copy,Variables,Hyperparameters["window_size"])
    MVR = ML.Split(MVR[0],MVR[1],TTV)

    train_x, train_y = MVR[0]
    test_x, test_y = MVR[1]
    validation_x, validation_y = MVR[2]
    Model = ML.Custom_Network_Model(
        (train_x,test_x,validation_x),
        (train_y,test_y,validation_y),
        Hyperparameters["batch_size"],
        Hyperparameters["epochs"],
        Hyperparameters["learning_rate"],
        Hyperparameters["optimizer"],
        Hyperparameters["loss_function"],
        Model_Obj,
        SocketIO_Reference,
        Threading_Reference
    )
    SocketIO_Reference.start_background_task(Model.train())
    Threading_Reference.wait()

    Variables.append("timestamp")
    PredictionSequence = validation_x[-1].reshape(1,validation_x.shape[1],validation_x.shape[2])
    Predictions = np.empty((0,var_count))
    #perform recursive prediction
    for x in range(Hyperparameters["prediction_steps"]):
        Prediction = Model.predict(PredictionSequence)[0]
        Predictions = np.append(Predictions,Prediction.reshape(1,var_count),axis=0)
        Prediction = Prediction.reshape((1,1,Prediction.shape[0]))
        PredictionSequence = np.append(PredictionSequence[:,1:,:],Prediction,axis=1)
    Predictions = Predictions.transpose()
    #denormalization
    DeNormalizedPrediction={}
    for i,key in zip(range(var_count),Variables):
        DeNormalizedPrediction[key] = denormalization_dispatcher[Norm_Method](*normdenorm_arg_dispatcher[Norm_Method](list(Predictions[i]),i))

    #generate timestamps for each prediction step
    TimeOrigin = datetime.fromtimestamp(to_export[-1]["timestamp"]/1000)
    GeneratedTime = [TimeOrigin + timedelta(days=i) for i in range(Hyperparameters["prediction_steps"])]
    DeNormalizedPrediction["timestamp"] = GeneratedTime

    #generate and assign random colors
    DeNormalizedPrediction = [dict(zip(DeNormalizedPrediction.keys(), values)) for values in zip(*DeNormalizedPrediction.values())]


    #generate n colors for each variable
    colors=[]
    for _ in range(var_count):
        rgb = np.random.randint(20, 256, size=3)
        hex = "#{:02x}{:02x}{:02x}".format(*rgb)
        colors.append(hex)

    for i in range(Hyperparameters["prediction_steps"]):
        DeNormalizedPrediction[i]["colorscheme"] = colors

    colors=[]
    for _ in range(var_count):
        rgb = np.random.randint(20, 256, size=3)
        hex = "#{:02x}{:02x}{:02x}".format(*rgb)
        colors.append(hex)

    for x in to_export:
        x["colorscheme"] = colors


    Payload={
        "Prediction":to_export+DeNormalizedPrediction,
        "Loss":[Model.Train_Loss,Model.Test_Loss],
        "Accuracy": [Model.Test_Accuracy,Model.Train_Accuracy]
    }

    return{
        "payload":Payload,
        "error":None
    }
if __name__=="__main__":
    SocketIO_Reference.run(app, debug=True)