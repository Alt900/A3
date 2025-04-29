import * as d3 from 'd3';
import {
  DataStructure,
  DynamicInterface,
  PredictionData,
  HyperparameterInterface
} from './GlobalStateManager';

export class GraphManager{
  static DataDescriptor:DynamicInterface={
    "Loss":{
      "Min":0,
      "Max":0,
      "Data":[[]],
      "Labels":["Training Loss","Testing Loss"],
      "ColorScheme":["#fc0317","#fcba03"]
    },
    "Accuracy":{
      "Min":0,
      "Max":0,
      "Data":[[]],
      "Labels":["Training Accuracy","Testing Accuracy"],
      "ColorScheme":["#fc0317","#fcba03"]
    },
    "PredictionData":{
      "Min":0,
      "Max":0,
      "Data":[[]],
      "Labels":[],
      "ColorScheme":[["#ff0000","#00ff11","#2a00fc","#00b5fc"],["#00ffff","#ff00ee","#d5ff03","#ff4a03"]]
    },
    "ClassicData":{
        "Min":0,
        "Max":0,
        "NormalizedMax":0,
        "NormalizedMin":0,
        "Data":[[]],
        "Labels":[],
        "ColorScheme":[["#00ffff","#ff00ee","#d5ff03","#ff4a03"],["#ff0000","#00ff11","#2a00fc","#00b5fc"]]
    }
  }

  static SVG:d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  static DragHandler:d3.DragBehavior<SVGSVGElement, unknown, unknown> = d3.drag<SVGSVGElement, unknown>();
  static Hyperparameters:typeof HyperparameterInterface = HyperparameterInterface; 
  static Height:number = 0;
  static Width:number = 0;
  static ViewBox:number[] = [0,0];

  private static XScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();
  private static YScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();

  public static MoveRatioRect(StartRatio:number,EndRatio:number):void{
    const Len:number = this.DataDescriptor["ClassicData"]["Data"][0].length;
    const ScaledLen:number = this.XScaling(Len);
    const Start:number = this.XScaling(Len*StartRatio);
    const End:number = this.XScaling(Len*EndRatio);
    const Middle:number = End-Start;

    this.Hyperparameters.Settings["train_ratio"] = StartRatio;
    this.Hyperparameters.Settings["test_ratio"] = parseFloat((EndRatio-StartRatio).toFixed(2));
    this.Hyperparameters.Settings["validation_ratio"] = parseFloat((1-EndRatio).toFixed(2));

    const TrainRect = d3.select("#TrainingRect");
    const TestRect = d3.select("#TestingRect");
    const ValidationRect = d3.select("#ValidationRect");
    const TrainText = d3.select("#TrainingText");
    const TestText = d3.select("#TestingText");
    const ValidationText = d3.select("#ValidationText");

    TrainRect.attr("x",0).attr("width",Start);
    TestRect.attr("x",Start).attr("width",Middle);
    ValidationRect.attr("x",End).attr("width",ScaledLen-End);
    TrainText.attr("x",Start/2).text(`Training ratio ${Math.round(StartRatio*100)}%`);
    TestText.attr("x",End-(Middle/2)).text(`Testing ratio ${Math.round((1-(StartRatio+(1-EndRatio)))*100)}%`);
    ValidationText.attr("x",End+(ScaledLen-End)/2).text(`Validation ratio ${Math.round((1-EndRatio)*100)}%`);
  }

  public static MV_MouseMove(Key:string,SubKey:string,Prediction:boolean,E:MouseEvent):void{
    let [x] = d3.pointer(E,E.target);
    x = Math.round(x);
    let PreviousY:number = 0;
    let Modifier:number = 30;
    const Index:number = Math.round(this.XScaling.invert(x));
    const Len:number = this.DataDescriptor[Key][SubKey][0].length;
    let CutOff:number = 0;
    if(Prediction){
      CutOff = Len-this.Hyperparameters.Settings["prediction_steps"];
    } else {
      CutOff = Len;
    }

    if(this.SVG){
      this.SVG.selectAll("#NavigationCircle").remove();
      this.SVG.selectAll("#NavigationText").remove();
      for(let I=0; I<this.DataDescriptor[Key][SubKey].length; I++){
        const DataPoint:number = this.DataDescriptor[Key][SubKey][I][Index].toFixed(2);
        const Color:string = Key === "PredictionData" || Key === "ClassicData"?
          this.DataDescriptor[Key]["ColorScheme"][Index > CutOff?0:1][I]:
          this.DataDescriptor[Key]["ColorScheme"][I];

        if(DataPoint){
          const YCoordinate:number = this.YScaling(DataPoint);
          if(PreviousY!==0 && Math.abs(PreviousY-YCoordinate) < 30){
            this.SVG.append("circle")
              .attr("cx",x)
              .attr("cy",YCoordinate+Modifier)
              .attr("r",5)
              .attr("id","NavigationCircle")
              .attr("stroke",Color);

            this.SVG.append("text")
              .attr("x",x)
              .attr("y",YCoordinate+Modifier)
              .text(`${this.DataDescriptor[Key]['Labels'][I]}: ${DataPoint}`)
              .attr("id","NavigationText")
              .attr("color",Color)
              .attr("stroke",Color);

          } else {
            this.SVG.append("circle")
              .attr("cx",x)
              .attr("cy",YCoordinate)
              .attr("r",5)
              .attr("id","NavigationCircle")
              .attr("stroke",Color);

            this.SVG.append("text")
              .attr("x",x)
              .attr("y",YCoordinate)
              .text(`${this.DataDescriptor[Key]['Labels'][I]}: ${DataPoint}`)
              .attr("id","NavigationText")
              .attr("color",Color)
              .attr("stroke",Color);
          }
          PreviousY = YCoordinate;
        }
      }
    }
  }

  public static DragHandlerDrag(E:any):void{
    if(this.SVG){
      this.ViewBox[0] -= E.dx;
      this.ViewBox[1] -= E.dy;
      this.SVG.attr("viewBox",[this.ViewBox[0],this.ViewBox[1],this.Width,this.Height]);
    }
  }

  public static Initialize(
    D3SVG:SVGSVGElement,
    W:number,
    H:number,
  ):void{
    this.SVG = d3.select(D3SVG);
    this.Height = H;
    this.Width = W;
    this.DragHandler
      .on("start",(_:any)=>{})
      .on("drag",this.DragHandlerDrag.bind(this))
      .on("end",(_:any)=>{});
    this.SVG
      ?.attr("id","SVGContainer")
      .attr("viewBox",[0,0,this.Width,this.Height])
      .call(this.DragHandler.bind(this));
  }

  public static ResetDataDescriptor(Keys:string[]):void{
    //pass a array of keys 
    //iterate over the array of keys and set this.DataDescriptor[key] to {default}
    Keys.forEach((Key:string)=>{
      if(Key=="Loss" || Key=="Accuracy"){
        this.DataDescriptor[Key] = {
          "Min":0,
          "Max":0,
          "Data":[[]],
          "Labels":["Training Loss","Testing Loss"],
          "ColorScheme":["#fc0317","#fcba03"]
        }
      } else if(Key=="PredictionData"){
        this.DataDescriptor["PredictionData"] = {
          "Min":0,
          "Max":0,
          "Data":[[]],
          "Labels":[],
          "ColorScheme":[["#00ffff","#ff00ee","#d5ff03","#ff4a03"],["#ff0000","#00ff11","#2a00fc","#00b5fc"]]
        }
      } else{
        this.DataDescriptor["ClassicData"] = {
          "Min":0,
          "Max":0,
          "NormalizedMax":0,
          "NormalizedMin":0,
          "Data":[[]],
          "NormalizedData":[[]],
          "Labels":[],
          "ColorScheme":[["#00ffff","#ff00ee","#d5ff03","#ff4a03"],["#ff0000","#00ff11","#2a00fc","#00b5fc"]]
        }
      }
    });
  }

  public static ReloadSVG(S:SVGSVGElement):void{this.SVG=d3.select(S);}

  public static CleanSVG():void{d3.selectAll("svg > *").remove();}

  public static ParseClassicDataResponse(Data:DataStructure[]):void{
    const Variables = Object.keys(Data[0]);
    Variables.pop();
    this.DataDescriptor["ClassicData"]["Labels"] = Variables;
    Data.forEach((obj:DataStructure)=>{
      for(let I = 0; I<Variables.length; I++){
        if(this.DataDescriptor["ClassicData"]["Data"][I] === undefined){
          this.DataDescriptor["ClassicData"]["Data"][I] = [];
          this.DataDescriptor["ClassicData"]["NormalizedData"][I] = [];
        }
        this.DataDescriptor["ClassicData"]["Data"][I].push(obj[Variables[I] as keyof DataStructure]);
      }
    });
    const FlattenedDataFrame:number[] = [].concat(...this.DataDescriptor["ClassicData"]["Data"]);
    this.DataDescriptor["ClassicData"]["Min"] = Math.min(...FlattenedDataFrame);
    this.DataDescriptor["ClassicData"]["Max"] = Math.max(...FlattenedDataFrame);
  }

  public static ParsePredictionResponse(Data:PredictionData):void{
    //extract accuracy and loss
    this.DataDescriptor["Loss"]["Data"] = Data.Loss;
    this.DataDescriptor["Accuracy"]["Data"] = Data.Accuracy;
    const Variables = Object.keys(Data.Prediction[0]);
    Variables.pop();//remove timestamp
    //pass variables to labels
    this.DataDescriptor["PredictionData"]["Labels"] = Variables;
    //extract prediction data
    Data.Prediction.forEach((obj:DataStructure)=>{
      for(let I = 0; I<Variables.length; I++){
        if(this.DataDescriptor["PredictionData"]["Data"][I] === undefined){
          this.DataDescriptor["PredictionData"]["Data"][I] = [];
        }
        this.DataDescriptor["PredictionData"]["Data"][I].push(obj[Variables[I] as keyof DataStructure]);
      }
    });

    //extract prediction, loss, and accuracy min and max
    const FlattenedDataFrame:number[] = [].concat(...this.DataDescriptor["PredictionData"]["Data"]);
    const FlattenedLoss:number[] = [].concat(...this.DataDescriptor["Loss"]["Data"]);
    const FlattenedAccuracy:number[] = [].concat(...this.DataDescriptor["Accuracy"]["Data"]);
    this.DataDescriptor["PredictionData"]["Min"] = Math.min(...FlattenedDataFrame);
    this.DataDescriptor["PredictionData"]["Max"] = Math.max(...FlattenedDataFrame);
    this.DataDescriptor["Loss"]["Min"] = Math.min(...FlattenedLoss);
    this.DataDescriptor["Loss"]["Max"] = Math.max(...FlattenedLoss);
    this.DataDescriptor["Accuracy"]["Min"] = Math.min(...FlattenedAccuracy);
    this.DataDescriptor["Accuracy"]["Max"] = Math.max(...FlattenedAccuracy);
  }

  public static DrawAccLossMultivariate(Key:string):void{
    this.XScaling.domain([0,this.DataDescriptor[Key]["Data"][0].length]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor[Key]["Min"],this.DataDescriptor[Key]["Max"]]).range([this.Height,0]);
    if(this.SVG){
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,Key,"Data",false));
      for(let I=0; I<this.DataDescriptor[Key]["Data"].length; I++){
        const G = this.SVG.append("g");
        for(let J=0; J<this.DataDescriptor[Key]["Data"][0].length-1; J++){
          G.append("line")
            .attr("x1",this.XScaling(J))
            .attr("x2",this.XScaling(J+1))
            .attr("y1",this.YScaling(this.DataDescriptor[Key]["Data"][I][J]))
            .attr("y2",this.YScaling(this.DataDescriptor[Key]["Data"][I][J+1]))
            .attr("stroke",this.DataDescriptor[Key]["ColorScheme"][I]);
        }
      }
      this.SVG.append("g")
        .attr("class","x-grid")
        .attr("transform",`translate(0,${this.Height})`)
        .call(
          d3.axisBottom(this.XScaling).tickSize(-this.Height)
        );
      this.SVG.append("g")
        .attr("class","y-grid")
        .call(
          d3.axisLeft(this.YScaling).tickSize(-this.Width)
        );
    }
  }

  public static DrawPredictionMultivariate(Key:string,SubKey:string,Prediction:boolean):void{
    let CutOff:number = 0;
    if(Prediction){
      CutOff = this.DataDescriptor[Key][SubKey][0].length-this.Hyperparameters.Settings["prediction_steps"];
    } else {
      CutOff = this.DataDescriptor[Key][SubKey][0].length;
    }
    this.XScaling.domain([0,this.DataDescriptor[Key][SubKey][0].length]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor[Key][SubKey==="NormalizedData"?"NormalizedMin":"Min"],this.DataDescriptor[Key][SubKey==="NormalizedData"?"NormalizedMax":"Max"]]).rangeRound([this.Height,0]);
    if(this.SVG){
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,Key,SubKey,Prediction));
      for(let I=0; I<this.DataDescriptor[Key][SubKey].length; I++){
        const G = this.SVG.append("g");
        for(let J=0; J<=this.DataDescriptor[Key][SubKey][0].length-2; J++){
          const Color:string = J>CutOff?this.DataDescriptor[Key]["ColorScheme"][1][I]:this.DataDescriptor["PredictionData"]["ColorScheme"][0][I];
          G.append("line")
            .attr("x1",this.XScaling(J))
            .attr("x2",this.XScaling(J+1))
            .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][I][J]))
            .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][I][J+1]))
            .attr("stroke",Color);
        }
      }
      if(!Prediction){
        this.SVG.append("rect").attr("id","TrainingRect").attr("fill","#00ff00").attr("height",this.Height).style("opacity",0.2);
        this.SVG.append("rect").attr("id","TestingRect").attr("fill","#0000ff").attr("height",this.Height).style("opacity",0.2);
        this.SVG.append("rect").attr("id","ValidationRect").attr("fill","#ff000040").attr("height",this.Height).style("opacity",0.2);
        this.SVG.append("text").attr("id","TrainingText").attr("stroke","#00ff00").attr("y",-10);
        this.SVG.append("text").attr("id","TestingText").attr("stroke","#0000ff").attr("y",-10);
        this.SVG.append("text").attr("id","ValidationText").attr("stroke","#ff000040").attr("y",-10);
      }
      this.SVG.append("g")
        .attr("class","x-grid")
        .attr("transform",`translate(0,${this.Height})`)
        .call(
          d3.axisBottom(this.XScaling).tickSize(-this.Height)
        );
      this.SVG.append("g")
        .attr("class","y-grid")
        .call(
          d3.axisLeft(this.YScaling).tickSize(-this.Width)
        );
    }
  }

  public static DrawBarChart(Key:string,SubKey:string,Prediction:boolean):void{
    let BarHeight:number = 0;
    let DataRange:number = 0;
    if(Prediction){
      DataRange = this.DataDescriptor[Key][SubKey][0].length-this.Hyperparameters.Settings["prediction_steps"];
    } else {
      DataRange = this.DataDescriptor[Key][SubKey][0].length;
    }
    this.XScaling.domain([0,DataRange]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor[Key]["Min"],this.DataDescriptor[Key]["Max"]]).range([this.Height,0]);
    if(this.SVG){
      const BarGroup = this.SVG.append("g");
      for(let I=0; I<=4; I++){
        for(let J=0; J<=DataRange; J++){
          BarHeight = this.DataDescriptor[Key][SubKey][3][J] - this.DataDescriptor[Key][SubKey][0][J];
          BarGroup.append("rect")
            .attr("x",this.XScaling(J)+6)
            .attr("y",this.YScaling(this.DataDescriptor[Key][SubKey][3][J]))
            .attr("width",5)
            .attr("height",Math.abs(BarHeight))
            .attr("fill",BarHeight<0?"#5df542":"#f20020");
        }
      }
      this.SVG.append("g")
        .attr("class","x-grid")
        .attr("transform",`translate(0,${this.Height})`)
        .call(
          d3.axisBottom(this.XScaling).tickSize(-this.Height)
        );
      this.SVG.append("g")
        .attr("class","y-grid")
        .call(
          d3.axisLeft(this.YScaling).tickSize(-this.Width)
        );
    }
  }
}