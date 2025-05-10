import * as d3 from 'd3';
import { Selection } from "d3-selection";
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
      "ColorScheme":[["#fc0317","#fcba03"],["#fc0317","#fcba03"]]
    },
    "Accuracy":{
      "Min":0,
      "Max":0,
      "Data":[[]],
      "Labels":["Training Accuracy","Testing Accuracy"],
      "ColorScheme":[["#fc0317","#fcba03"],["#fc0317","#fcba03"]]
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
  static CoordinateTransform:d3.ZoomTransform = d3.zoomIdentity;

  private static XScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();
  private static YScaling:d3.ScaleLinear<number, number, never> = d3.scaleLinear();
  private static ZoomedXScaling = this.XScaling.copy();
  private static ZoomedYScaling = this.YScaling.copy();

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

  public static MV_MouseMove(Key:string,SubKey:string,E:MouseEvent):void{
    let [x,y] = d3.pointer(E,this.SVG?.node());
    const Index:number = Math.round(this.ZoomedXScaling.invert(x));
    x = Math.round(x);
    const Sign:string = Key==="Loss"||Key==="Accuracy"?"%":"$"
    if(this.SVG && this.DataDescriptor[Key][SubKey][0][Index] !== undefined){
      //navigation text update
      this.SVG.select("#NavigationTextRect").attr("height",this.DataDescriptor[Key][SubKey].length*30);
      this.SVG.selectAll("#NavigationText").remove();
      for(let I=0; I<this.DataDescriptor[Key]["Data"].length; I++){
        this.SVG.append("text")
          .attr("id","NavigationText")
          .attr("x",1)
          .attr("y",(I+1)*26)
          .attr("stroke",this.DataDescriptor[Key]['ColorScheme'][1][I])
          .text(`${this.DataDescriptor[Key]['Labels'][I]}: ${Sign}${d3.format('.2f')(this.DataDescriptor[Key][SubKey][I][Index])}`);
      }
      this.SVG.select("#XNavLine").attr("x1",x).attr("x2",x);
      this.SVG.select("#YNavLine").attr("y1",y).attr("y2",y);
    }
  }

  public static DragHandlerDrag(E:any):void{
    if(this.SVG){
      this.CoordinateTransform = this.CoordinateTransform.translate(E.dx,E.dy);
      const TransformString:string = this.CoordinateTransform.toString();
      const Numbers:RegExpExecArray[] = Array.from(TransformString.matchAll(/-?\d+(\.\d+)?/g));
      const X:number = parseFloat(Numbers[0][0]);
      const K:number = parseFloat(Numbers[2][0]);
      this.SVG.select("#MainDrawGroup").attr("transform",TransformString);
      this.SVG.call(this.Zoom.transform,this.CoordinateTransform);
      this.SVG.select("#TTVRects").attr("transform",`translate(${X},0), scale(${K})`);
    }
  }

  public static ZoomHandler(E:d3.D3ZoomEvent<SVGSVGElement, unknown>):void{
    this.CoordinateTransform = E.transform;
    this.ZoomedXScaling = E.transform.rescaleX(this.XScaling);
    this.ZoomedYScaling = E.transform.rescaleY(this.YScaling);
    const XGrid:Selection<SVGGElement, unknown, HTMLElement, any> = d3.select("#x-grid");
    const YGrid:Selection<SVGGElement, unknown, HTMLElement, any> = d3.select("#y-grid");
    XGrid.call(d3.axisBottom(this.ZoomedXScaling).tickSize(this.Height)).selectAll(".tick text").attr("dy","-1em");
    YGrid.call(d3.axisRight(this.ZoomedYScaling).tickSize(this.Width)).selectAll(".tick text").attr("dx","-2em");
    if(this.SVG){
      this.SVG.select("#TTVRects").attr("transform",`translate(${E.transform.x},0) scale(${E.transform.k})`);
      this.SVG.select("#MainDrawGroup").attr("transform",this.CoordinateTransform.toString());
    }
  }

  public static Zoom:d3.ZoomBehavior<SVGSVGElement, unknown> = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1,5]).on("zoom",this.ZoomHandler.bind(this));

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
      .call(this.DragHandler.bind(this))
      .call(this.Zoom);
  }

  public static InjectComponents(Components:string[]){
    Components.forEach((Component:string)=>{
      if(this.SVG){
        if(Component==="NavigationCrosshair"){
          this.SVG.append("line")
            .attr("id","XNavLine")
            .attr("stroke","gray")
            .attr("x1",0)
            .attr("x2",0)
            .attr("y1",this.YScaling(this.YScaling.domain()[0]))
            .attr("y2",0)
            .style("stroke-dasharray", "5,5");
          
          this.SVG.append("line")
            .attr("id","YNavLine")
            .attr("stroke","gray")
            .attr("x1",0)
            .attr("x2",this.XScaling(this.Width))
            .attr("y1",0)
            .attr("y2",0)
            .style("stroke-dasharray", "5,5");
        } else if(Component==="TTVRects"){
          const TTV = this.SVG.append("g").attr("id","TTVRects");
          TTV.append("rect").attr("id","TrainingRect").attr("fill","#00ff00").attr("height",this.Height).style("opacity",0.2);
          TTV.append("rect").attr("id","TestingRect").attr("fill","#0000ff").attr("height",this.Height).style("opacity",0.2);
          TTV.append("rect").attr("id","ValidationRect").attr("fill","#ff000040").attr("height",this.Height).style("opacity",0.2);
          TTV.append("text").attr("id","TrainingText").attr("stroke","#00ff00").attr("y",15);
          TTV.append("text").attr("id","TestingText").attr("stroke","#0000ff").attr("y",15);
          TTV.append("text").attr("id","ValidationText").attr("stroke","#ff000040").attr("y",15);
        } else if(Component==="NavigationText"){
          this.SVG.append("rect")//adjust height on mousemove
            .attr("id","NavigationTextRect")
            .attr("x",0)
            .attr("y",0)
            .attr("width",150)
            .attr("height",25)
            .attr("fill","#191919")
            .attr("opacity",1)
            .attr("stroke","gray");
        } else if(Component==="GridLines"){
          this.SVG.append("g")
            .attr("id","x-grid")
            .attr("stroke","white")
            .attr("color","gray")
            .call(
              d3.axisBottom(this.ZoomedXScaling).tickSize(this.Height)
            )
            .selectAll(".tick text")
            .attr("dy","-1em");

          this.SVG.append("g")
            .attr("id","y-grid")
            .attr("stroke","white")//tick color
            .attr("color","gray")//line color
            .call(
              d3.axisRight(this.YScaling).tickSize(this.Width)
            )
            .selectAll(".tick text")
            .attr("dx","-2em");
        }
      }
    })
  }

  public static HideTTV():void{
    if(this.SVG){
      this.SVG.select("#TrainingRect").attr("fill","#191919").attr("opacity",1);
      this.SVG.select("#TestingRect").attr("fill","#191919").attr("opacity",1);
      this.SVG.select("#ValidationRect").attr("fill","#191919").attr("opacity",1);
      this.SVG.select("#TrainingText").attr("stroke","#191919").attr("opacity",0);
      this.SVG.select("#TestingText").attr("stroke","#191919").attr("opacity",0);
      this.SVG.select("#ValidationText").attr("stroke","#191919").attr("opacity",0);
    }
  }

  public static ShowTTV():void{
    if(this.SVG){
      this.SVG.select("#TrainingRect").attr("fill","#00ff00").attr("opacity",0.2);
      this.SVG.select("#TestingRect").attr("fill","#0000ff").attr("opacity",0.2);
      this.SVG.select("#ValidationRect").attr("fill","#ff000040").attr("opacity",0.2);
      this.SVG.select("#TrainingText").attr("stroke","#00ff00").attr("opacity",1);
      this.SVG.select("#TestingText").attr("stroke","#0000ff").attr("opacity",1);
      this.SVG.select("#ValidationText").attr("stroke","#ff000040").attr("opacity",1);
    }
  }

  public static ResetDataDescriptor(Keys:string[]):void{
    Keys.forEach((Key:string)=>{
      if(Key=="Loss" || Key=="Accuracy"){
        this.DataDescriptor[Key] = {
          "Min":0,
          "Max":0,
          "Data":[[]],
          "Labels":["Training Loss","Testing Loss"],
          "ColorScheme":[["#fc0317","#fcba03"],["#fc0317","#fcba03"]]
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

  public static DrawPredictionMultivariate(Key:string,SubKey:string,Prediction:boolean):void{
    this.XScaling.domain([0,this.DataDescriptor[Key][SubKey][0].length]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor[Key][SubKey==="NormalizedData"?"NormalizedMin":"Min"],this.DataDescriptor[Key][SubKey==="NormalizedData"?"NormalizedMax":"Max"]]).rangeRound([this.Height,0]);
    this.ZoomedXScaling = this.XScaling.copy();
    this.ZoomedYScaling = this.YScaling.copy();

    if(this.SVG){
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,Key,SubKey));
      const G = this.SVG.append("g").attr("id","MainDrawGroup");
      if(Prediction){
        this.InjectComponents(["GridLines","NavigationCrosshair","NavigationText"]);
        const DataEnd:number = (this.DataDescriptor[Key][SubKey][0].length-1)-this.Hyperparameters.Settings["prediction_steps"];
        for(let I=0; I<this.DataDescriptor[Key][SubKey].length; I++){
          for(let J=0; J<DataEnd; J++){
            G.append("line")
              .attr("x1",this.XScaling(J))
              .attr("x2",this.XScaling(J+1))
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][I][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][I][J+1]))
              .attr("stroke",this.DataDescriptor[Key]["ColorScheme"][1][I]);
          }
          for(let J=DataEnd; J<this.DataDescriptor[Key][SubKey][0].length-1; J++){
            G.append("line")
              .attr("x1",this.XScaling(J))
              .attr("x2",this.XScaling(J+1))
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][I][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][I][J+1]))
              .attr("stroke",this.DataDescriptor[Key]["ColorScheme"][0][I])//the correct color has been chosen but does not show
              .attr("color",this.DataDescriptor[Key]["ColorScheme"][0][I]);
          }
        }
      } else {
        this.InjectComponents(["GridLines","TTVRects","NavigationCrosshair","NavigationText"]);
        for(let I=0; I<this.DataDescriptor[Key][SubKey].length; I++){
          console.log(this.DataDescriptor[Key]["ColorScheme"][1][I])
          for(let J=0; J<this.DataDescriptor[Key][SubKey][0].length-1; J++){
            G.append("line")
              .attr("x1",this.XScaling(J))
              .attr("x2",this.XScaling(J+1))
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][I][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][I][J+1]))
              .attr("stroke",this.DataDescriptor[Key]["ColorScheme"][1][I]);
          }
        }
      }
    }
  }

  public static DrawBarChart(Key:string,SubKey:string,Prediction:boolean):void{

    this.XScaling.domain([0,this.DataDescriptor[Key][SubKey][0].length]).range([0,this.Width]);
    this.YScaling.domain([this.DataDescriptor[Key]["Min"],this.DataDescriptor[Key]["Max"]]).range([this.Height,0]);
    const Padding:number = 1.25;
    if(this.SVG){
      this.SVG.on('mousemove',this.MV_MouseMove.bind(this,Key,SubKey));
      const BarGroup = this.SVG.append("g").attr("id","MainDrawGroup");
      if(Prediction){
        this.InjectComponents(["GridLines","NavigationCrosshair","NavigationText"]);
        const DataEnd:number = (this.DataDescriptor[Key][SubKey][0].length-1)-this.Hyperparameters.Settings["prediction_steps"]
        for(let I=0; I<=4; I++){
          for(let J=0; J<DataEnd; J++){
            const Difference:number = this.DataDescriptor[Key][SubKey][3][J] - this.DataDescriptor[Key][SubKey][0][J];
            const Color:string = Difference<0?"#5df542":"#f20020";
            const BaseX:number = this.XScaling(J)
            const X:number = BaseX+2.5;

            BarGroup.append("line")
              .attr("x1",X)
              .attr("x2",X)
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][1][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][2][J]))
              .attr("stroke",Color);
            BarGroup.append("rect")
              .attr("x",BaseX+Padding)
              .attr("y",this.YScaling(Math.max(this.DataDescriptor[Key][SubKey][3][J],this.DataDescriptor[Key][SubKey][0][J])))
              .attr("width",5-Padding*2)
              .attr("height",Math.abs(this.YScaling(this.DataDescriptor[Key][SubKey][3][J])-this.YScaling(this.DataDescriptor[Key][SubKey][0][J])))
              .attr("fill",Color);
          }
          for(let J=DataEnd; J<this.DataDescriptor[Key][SubKey][0].length; J++){
            const Difference:number = this.DataDescriptor[Key][SubKey][3][J] - this.DataDescriptor[Key][SubKey][0][J];
            const Color:string = Difference<0?"#42f5b3":"#f50581";
            const BaseX:number = this.XScaling(J)
            const X:number = BaseX+2.5;

            BarGroup.append("line")
              .attr("x1",X)
              .attr("x2",X)
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][1][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][2][J]))
              .attr("stroke",Color);
            BarGroup.append("rect")
              .attr("x",BaseX+Padding)
              .attr("y",this.YScaling(Math.max(this.DataDescriptor[Key][SubKey][3][J],this.DataDescriptor[Key][SubKey][0][J])))
              .attr("width",5-Padding*2)
              .attr("height",Math.abs(this.YScaling(this.DataDescriptor[Key][SubKey][3][J])-this.YScaling(this.DataDescriptor[Key][SubKey][0][J])))
              .attr("fill",Color);
          }
        }
      } else {
        this.InjectComponents(["GridLines","TTVRects","NavigationCrosshair","NavigationText"]);
        for(let I=0; I<=4; I++){
          for(let J=0; J<this.DataDescriptor[Key][SubKey][0].length-1; J++){
            const Difference:number = this.DataDescriptor[Key][SubKey][3][J] - this.DataDescriptor[Key][SubKey][0][J];
            const Color:string = Difference<0?"#5df542":"#f20020";
            const BaseX:number = this.XScaling(J)
            const X:number = BaseX+2.5;

            BarGroup.append("line")
              .attr("x1",X)
              .attr("x2",X)
              .attr("y1",this.YScaling(this.DataDescriptor[Key][SubKey][1][J]))
              .attr("y2",this.YScaling(this.DataDescriptor[Key][SubKey][2][J]))
              .attr("stroke",Color);
            BarGroup.append("rect")
              .attr("x",BaseX+Padding)
              .attr("y",this.YScaling(Math.max(this.DataDescriptor[Key][SubKey][3][J],this.DataDescriptor[Key][SubKey][0][J])))
              .attr("width",5-Padding*2)
              .attr("height",Math.abs(this.YScaling(this.DataDescriptor[Key][SubKey][3][J])-this.YScaling(this.DataDescriptor[Key][SubKey][0][J])))
              .attr("fill",Color);
          }
        }
      }
    }
  }
}