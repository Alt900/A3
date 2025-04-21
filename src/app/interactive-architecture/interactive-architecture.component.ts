import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  SimpleChanges
} from '@angular/core';

import {
  AccLossPlot, 
  MultivariateChart,
  CandleStick
} from '../Charts';

import {
  DynamicInterface,
  DataStructure,
  PredictionData,
  HyperparameterInterface,
  StaticDataInterface,
  LayerHyperparametersInterface
} from '../GlobalStateManager';

import {Interactables_3D} from '../3D_Views';

import { CommonModule } from '@angular/common';
import {ReactiveFormsModule, FormsModule} from '@angular/forms';

import {provideNativeDateAdapter} from '@angular/material/core';

import {MatButtonModule} from '@angular/material/button';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatListModule} from '@angular/material/list';

import { Utils } from '../utils';


import * as d3 from 'd3';

@Component({
  selector: 'app-interactive-architecture',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatListModule,
    MatDatepickerModule,
    MatCheckboxModule
  ],
  providers:[provideNativeDateAdapter()],
  templateUrl: './interactive-architecture.component.html',
  styleUrl: './interactive-architecture.component.scss'
})

export class InteractiveArchitectureComponent implements AfterViewInit{
  @Input() AvailableTickers!:string[];

  StaticData: typeof StaticDataInterface = StaticDataInterface;
  HyperParameters:typeof HyperparameterInterface = HyperparameterInterface;
  LayerHyperParameters:typeof LayerHyperparametersInterface = LayerHyperparametersInterface;

  SelectedEndDate!:Date;
  SelectedStartDate!:Date;
  Overwrite:boolean=false;

  TempTicker:string="";
  SelectedInterval:string="1H";
  ChosenGraph:string = "3D Scene";
  SelectedSetting:string="Architecture";
  TickersToDownload:string[]=[];

  PredictionData:PredictionData={Accuracy:[[]],Loss:[[]],Prediction:[]};
  
  viewBox = {x:0,y:0,width:0,height:0};
  Height:number = 0;
  Width:number = 0;

  D3SVG!:d3.Selection<SVGSVGElement, unknown, null, undefined>;
  @ViewChild('ArchSVGContainer', { static: true }) SVGReference!: ElementRef<SVGSVGElement>;
  @ViewChild('ArchContainer',{static:true}) DivReference!: ElementRef<any>;

  DropdownDispatcher:DynamicInterface = {
    "normalization": ["Logarithmic","MinMax","Z_Score"],
    "variables": ["open","high","low","close","volume"],
    "ticker": this.AvailableTickers,
    "activation": this.StaticData.ActivationOptions,
    "optimizer": this.StaticData.Optimizers,
    "loss_function": this.StaticData.LossFunctions
  }

  async ngAfterViewInit():Promise<void>{
    const ParentDiv:HTMLDivElement = this.DivReference.nativeElement;
    const Rect = ParentDiv.getBoundingClientRect();
    this.D3SVG = d3.select(this.SVGReference.nativeElement);
    
    this.Width = Rect.width;
    this.Height = Rect.height;

    this.viewBox.width = Rect.width;
    this.viewBox.height = Rect.height;

    Interactables_3D.InitializeScene(this.Height,this.Width,ParentDiv);
    LayerHyperparametersInterface.Three_Reference = Interactables_3D;
  }

  ngOnChanges(changes:SimpleChanges):void{
    if(changes['AvailableTickers']){
      this.DropdownDispatcher['ticker'] = this.AvailableTickers;
    }
  }

  async DownloadTickers():Promise<void>{
    const To = this.SelectedEndDate!==null?this.SelectedEndDate.toISOString().split('T')[0]:null;
    const From = this.SelectedStartDate!==null?this.SelectedStartDate.toISOString().split("T")[0]:null;
    Utils.FetchRoute(
      `DownloadData?Tickers=${this.TickersToDownload}&to=${To}&from=${From}&interval=${this.SelectedInterval}&overwrite=${this.Overwrite}`);
    this.AvailableTickers = [...new Set([...this.AvailableTickers,...this.TickersToDownload])];
    this.DropdownDispatcher = {...this.DropdownDispatcher,"ticker":this.AvailableTickers}
  }

  SetSettings(value:string):void{
    this.SelectedSetting=value;
  }

  SetTempTicker(e:Event):void{
    this.TempTicker=<string>(<HTMLInputElement>e.target).value;
  }

  RemoveTicker():void{
    const Index:number = this.TickersToDownload.indexOf(this.TempTicker);
    this.TickersToDownload.splice(Index,1);
    this.TempTicker = "";
  }

  AddTicker():void{
    if(!this.TickersToDownload.includes(this.TempTicker)){
      this.TickersToDownload.push(this.TempTicker);
      this.TempTicker = "";
    }
  }

  CalculateLeft(i:number,modifier?:number):string{return `${i*(modifier===undefined?1:modifier)}%`}
  CalculateTop(i:number,modifier?:number):string{return `${i*(modifier===undefined?1:modifier)}%`}

  SetGraph(chosen:string):void{
    this.ChosenGraph = chosen;
    if(chosen === "Loss" || chosen === "Accuracy"){
      const dragHandler: d3.DragBehavior<SVGSVGElement, unknown, unknown> = d3.drag<SVGSVGElement, unknown>();
      
      dragHandler
        .on("start",(_:any)=>{})
        .on("drag",(e:any)=>{
          this.viewBox.x -= e.dx;
          this.viewBox.y -= e.dy;
          this.D3SVG.attr('viewBox',`${this.viewBox.x} ${this.viewBox.y} ${this.Width} ${this.Height}`);
        })
        .on("end",(_:any)=>{});

      d3.selectAll("svg > *").remove();

      this.D3SVG = d3.select(this.SVGReference.nativeElement)
        .attr("id","SVGContainer")
        .attr("viewBox",[0,0,this.Width,this.Height])
        .call(dragHandler);

      this.D3SVG = d3.select(this.SVGReference.nativeElement).attr("viewBox",[0,0,this.Width,this.Height]);

      const Data = chosen==="Accuracy"?this.PredictionData.Accuracy:this.PredictionData.Loss;

      AccLossPlot(
        this.D3SVG,
        Data,
        this.Width,
        this.Height,
        ["orange","red"],
        ["train","test"],
        100,
      );
    } else {
      const dragHandler: d3.DragBehavior<SVGSVGElement, unknown, unknown> = d3.drag<SVGSVGElement, unknown>();
      
      dragHandler
        .on("start",(_:any)=>{})
        .on("drag",(e:any)=>{
          this.viewBox.x -= e.dx;
          this.viewBox.y -= e.dy;
          this.D3SVG.attr('viewBox',`${this.viewBox.x} ${this.viewBox.y} ${this.Width} ${this.Height}`);
        })
        .on("end",(_:any)=>{});

      d3.selectAll("svg > *").remove();

      this.D3SVG = d3.select(this.SVGReference.nativeElement)
        .attr("id","SVGContainer")
        .attr("viewBox",[0,0,this.Width,this.Height])
        .call(dragHandler);

      this.D3SVG = d3.select(this.SVGReference.nativeElement).attr("viewBox",[0,0,this.Width,this.Height]);

      const Data:number[][] = [];
      this.HyperParameters.Settings["variables"].forEach(()=>Data.push([]));
      this.PredictionData.Prediction.forEach((obj:DataStructure)=>{
        this.HyperParameters.Settings["variables"].forEach((key:string,index:number)=>{
          Data[index].push(obj[key as keyof DataStructure] as number);
        })
      });
      const Colors:string[][] = this.PredictionData.Prediction.map((d:DataStructure)=>d.colorscheme);
      if(['open','high','low','close'].every(key=>key in this.PredictionData.Prediction[0])){
        CandleStick(
          this.PredictionData.Prediction,
          this.D3SVG,
          this.Width,
          this.Height
        );
      } else {
        MultivariateChart(
          this.D3SVG,
          Data,
          this.Width,
          this.Height,
          [Colors[0],Colors[Colors.length-1]],
          this.HyperParameters.Settings["variables"],
          Math.log(Data[0].length),
          this.HyperParameters.Settings["prediction_steps"]
          );
        }
      }
  }

  async BuildRunArch():Promise<void>{
    const ParameterizedRoute:string = `CreateModel?Hyperparams=${JSON.stringify(this.HyperParameters.Settings)}&LayerArgs=${JSON.stringify(this.LayerHyperParameters.LayerArgs)}`;
    this.PredictionData = await Utils.FetchRoute(ParameterizedRoute);
    this.SetGraph("None");
  }
}