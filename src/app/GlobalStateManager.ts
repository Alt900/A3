export interface DynamicInterface{[key:string]:any;}

export interface DataStructure {
    close:number,
    high:number,
    low:number,
    open:number,
    timestamp:string,
  }
export interface PredictionData{
    Accuracy: number[][],
    Loss: number[][],
    Prediction:DataStructure[]
  }

export class HyperparameterInterface{
    static AvailableTickers:string[] = ['NULL'];

    static Settings:DynamicInterface={
        normalization:"Logarithmic",
        variables:["open"],
        ticker:this.AvailableTickers[0],
        optimizer:"Adam",
        loss_function:"MSELoss",
        batch_size:32,
        window_size:5,
        epochs:100,
        learning_rate:0.001,
        train_ratio:0.7,
        test_ratio:0.2,
        validation_ratio:0.1,
        prediction_steps:10
    }

    static SettignsKeys:string[]=Object.keys(this.Settings);

    public static ReRender():void{
        this.Settings = {...this.Settings}
    }

    public static SetSettings(e:Event,key:string):void{
        this.Settings[key] = +<string>(<HTMLInputElement>e.target).value;
        this.Settings = {...this.Settings}
      }
}

export class LayerHyperparametersInterface{
    static LayerArgs:DynamicInterface[]=[];
    static SelectedLayer:number = -1;
    static Three_Reference:any;
    static LayerOptions:number[] = [];

    private static ReRenderTriggers:string[] = [
      "cell_count",
      "kernel_size",
      "stride",
      "padding",
      "dilation",
      "filters"
    ];

    public static GetIndexArray():number[]{return [...Array(this.LayerArgs.length).keys()];}

    public static SetSelectedLayer(Index:number):void{this.SelectedLayer = Index;}
  
    public static AddLayer(Layer:string,Vars:number):void{
      const Index:number = this.LayerArgs.length;
  
      if (Layer === "1D Convolution" || Layer === "1D Pooling"){
        this.LayerArgs=([...this.LayerArgs,{
          cell_count:12,
          kernel_size:3,
          filters:2,
          dilation:0,
          stride:1,
          padding:0,
          activation:"None",
          layertype:Layer
        }]);
        this.Three_Reference.ConstructPoolLayer([3,1,0,0,2,Vars],Index*25,20,Index);
      } else {
        this.LayerArgs=([...this.LayerArgs,{
          cell_count: 10,
          dropout:0,
          activation:"None",
          layertype:Layer
        }]);
        this.Three_Reference.ConstructStaticLayer(10,Index*25,Layer,Index);
      }
      this.SelectedLayer = Index;
      this.LayerOptions.push(Index);
    }
  
    public static GetKeys(Index:number):string[]{
      return Object.keys(this.LayerArgs[Index]);
    }
  
    public static RemoveLayer(Index:number):void{
      this.LayerArgs = this.LayerArgs.filter((_,i:number) => i !== Index);
      this.LayerOptions = this.LayerOptions.filter((_,i:number)=>i!==Index).map((_,i)=>i);
      this.Three_Reference.RemoveLayer(Index);
      this.SelectedLayer = Index-1;
    }
  
    public static ChangeParameter(event:Event,Index:number,Key:string,Type:string):void{
      if(Type==="string"){
        this.LayerArgs[Index] = {...this.LayerArgs[Index],[Key]:<string>(<HTMLInputElement>event.target).value}
      } else if(Type==="number"){
        this.LayerArgs[Index] = {...this.LayerArgs[Index],[Key]:+<string>(<HTMLInputElement>event.target).value}
        if(this.ReRenderTriggers.includes(Key)){
          this.Three_Reference.ReRenderLayer(
            this.LayerArgs[Index]["layertype"]==="1D Convolution" || this.LayerArgs[Index]["layertype"]==="1D Pooling" ? [
              this.LayerArgs[Index]['kernel_size'],
              this.LayerArgs[Index]['stride'],
              this.LayerArgs[Index]['dilation'],
              this.LayerArgs[Index]['padding'],
              this.LayerArgs[Index]['filters'],
              4
            ]: null,
            this.LayerArgs[Index]['cell_count'],
            Index,
            this.LayerArgs[Index]["layertype"]
          );
        }
      }
    }
}

export class StaticDataInterface{
    static IntervalOptions:DynamicInterface[]=[
      {value:"1m",label:"1 Minute"},
      {value:"2m",label:"2 Minutes"},
      {value:"5m",label:"5 Minutes"},
      {value:"15m",label:"15 Minutes"},
      {value:"30m",label:"30 Minutes"},
      {value:"1h",label:"1 Hour"},
      {value:"1d",label:"1 Day"},
      {value:"5d",label:"5 Days"},
      {value:"1wk",label:"1 Week"},
      {value:"1mo",label:"1 Month"},
      {value:"3mo",label:"3 Months"}
    ];

    static LayerOptions:string[] =  [
      "LSTM Unidirectional",
      "GRU",
      "Dense",
      "1D Convolution",
      "1D Pooling",
      "Multi-Head Attention"
    ];
  
    static ActivationOptions:string[] = [
      "None",
      "ELU",
      "Hardshrink",
      "Hardsigmoid",
      "Hardtanh",
      "Hardswish",
      "LeakyReLU",
      "LogSigmoid",
      "PReLU",
      "ReLU",
      "ReLU6",
      "RReLU",
      "SELU",
      "CELU",
      "GELU",
      "Sigmoid",
      "SiLU",
      "Mish",
      "Softplus",
      "Softshrink",
      "Softsign",
      "Softmax",
      "Tanh",
      "Tanhshrink",
      "Threshold",
      "GLU"
    ];
  
    static Optimizers:string[]=[
      "Adadelta",
      "Adafactor",
      "Adagrad",
      "Adam",
      "AdamW",
      "SparseAdam",
      "Adamax",
      "ASGD",
      "LBFGS",
      "NAdam",
      "RAdam",
      "RMSprop",
      "Rprop",
      "SGD"
    ];
  
    static LossFunctions:string[]=[
      "L1Loss",
      "MSELoss",
      "CrossEntropyLoss",
      "CTCLoss",
      "NLLLoss",
      "PoissonNLLLoss",
      "GaussianNLLLoss",
      "KLDivLoss",
      "BCELoss",
      "BCEWithLogitsLoss",
      "MarginRankingLoss",
      "HingeEmbeddingLoss",
      "MultiLabelMarginLoss",
      "HuberLoss",
      "SmoothL1Loss",
      "SoftMarginLoss",
      "MultiLabelSoftMarginLoss",
      "CosineEmbeddingLoss",
      "MultiMarginLoss",
      "TripletMarginLoss",
      "TripletMarginWithDistanceLoss"
    ];
}