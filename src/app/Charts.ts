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
  }

  static SVG:d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  static DragHandler:d3.DragBehavior<SVGSVGElement, unknown, unknown> = d3.drag<SVGSVGElement, unknown>();
  static Hyperparameters:typeof HyperparameterInterface = HyperparameterInterface; 
  static Height:number = 0;
  static Width:number = 0;
  static ViewBox:number[] = [0,0];

  private static XScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();
  private static YScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();

  public static MV_MouseMove(Key:string,E:MouseEvent):void{
    let [x] = d3.pointer(E,E.target);
    x = Math.round(x);
    let PreviousY:number = 0;
    let Modifier:number = 30;
    const Index:number = Math.round(this.XScaling.invert(x));
    const Len:number = this.DataDescriptor[Key]["Data"][0].length;
    const Cutoff:number = Len-this.Hyperparameters.Settings["prediction_steps"];

    if(this.SVG){
      this.SVG.selectAll("#NavigationCircle").remove();
      this.SVG.selectAll("#NavigationText").remove();
      for(let I=0; I<this.DataDescriptor[Key]["Data"].length; I++){
        const DataPoint:number = this.DataDescriptor[Key]["Data"][I][Index].toFixed(2);
        const Color:string = Key==="PredictionData"?
          this.DataDescriptor[Key]["ColorScheme"][Index > Cutoff?0:1][I]:
          this.DataDescriptor[Key]["ColorScheme"][I]

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

  public static ResetDataDescriptor():void{
    this.DataDescriptor={
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
    }
  }

  public static ReloadSVG(S:SVGSVGElement):void{this.SVG=d3.select(S);}

  public static CleanSVG():void{d3.selectAll("svg > *").remove();}

  public static ParsePyResponse(Data:PredictionData):void{
    console.log(Data.Prediction)
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
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,Key));
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

  public static DrawPredictionMultivariate():void{
    const CutOff:number = this.DataDescriptor["PredictionData"]["Data"][0].length-this.Hyperparameters.Settings["prediction_steps"];
    this.XScaling.domain([0,this.DataDescriptor["PredictionData"]["Data"][0].length]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor["PredictionData"]["Min"],this.DataDescriptor["PredictionData"]["Max"]]).rangeRound([this.Height,0]);
    if(this.SVG){
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,"PredictionData"));
      for(let I=0; I<this.DataDescriptor["PredictionData"]["Data"].length; I++){
        const G = this.SVG.append("g");
        for(let J=0; J<=this.DataDescriptor["PredictionData"]["Data"][0].length-2; J++){
          const Color:string = J>CutOff?this.DataDescriptor["PredictionData"]["ColorScheme"][0][I]:this.DataDescriptor["PredictionData"]["ColorScheme"][1][I];
          G.append("line")
            .attr("x1",this.XScaling(J))
            .attr("x2",this.XScaling(J+1))
            .attr("y1",this.YScaling(this.DataDescriptor["PredictionData"]["Data"][I][J]))
            .attr("y2",this.YScaling(this.DataDescriptor["PredictionData"]["Data"][I][J+1]))
            .attr("stroke",Color);
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

  public static DrawBarChart():void{
    let BarHeight:number = 0;
    const DataRange:number = this.DataDescriptor["PredictionData"]["Data"][0].length-this.Hyperparameters.Settings["prediction_steps"];
    this.XScaling.domain([0,DataRange]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor["PredictionData"]["Min"],this.DataDescriptor["PredictionData"]["Max"]]).range([this.Height,0]);
    if(this.SVG){
      const BarGroup = this.SVG.append("g");
      for(let I=0; I<=4; I++){
        for(let J=0; J<=DataRange; J++){
          BarHeight = this.DataDescriptor["PredictionData"]["Data"][3][J] - this.DataDescriptor["PredictionData"]["Data"][0][J];
          BarGroup.append("rect")
            .attr("x",this.XScaling(J)+6)
            .attr("y",this.YScaling(this.DataDescriptor["PredictionData"]["Data"][3][J]))
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