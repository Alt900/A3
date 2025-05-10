//Custom libraries
import {Interactables_3D} from '../3D_Views';
import { GraphManager } from '../Charts';
import {
  DynamicInterface,
  PredictionData,
  HyperparameterInterface,
  StaticDataInterface,
  LayerHyperparametersInterface
} from '../GlobalStateManager';
import { Utils } from '../utils';

//Angular core
import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {ReactiveFormsModule, FormsModule} from '@angular/forms';

//Angular material M3
import {provideNativeDateAdapter} from '@angular/material/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatListModule} from '@angular/material/list';
import {MatSliderModule} from '@angular/material/slider';

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
    MatCheckboxModule,
    MatSliderModule
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
  Graphs:typeof GraphManager = GraphManager;

  SelectedEndDate!:Date;
  SelectedStartDate!:Date;
  Overwrite:boolean=false;

  TempTicker:string="";
  SelectedInterval:string="1H";
  ChosenGraph:string = "3D Scene";
  SelectedSetting:string="Architecture";
  TickersToDownload:string[]=[];

  PredictionData:PredictionData={Accuracy:[[]],Loss:[[]],Prediction:[]};
  @ViewChild('ArchSVGContainer', { static: true }) SVGReference!: ElementRef<SVGSVGElement>;
  @ViewChild('ArchContainer',{static:true}) DivReference!: ElementRef<any>;

  DropdownDispatcher:DynamicInterface = {
    "normalization": ["Logarithmic","MinMax","Z_Score"],
    "variables": ["open","high","low","close"],
    "ticker": this.AvailableTickers,
    "activation": this.StaticData.ActivationOptions,
    "optimizer": this.StaticData.Optimizers,
    "loss_function": this.StaticData.LossFunctions
  }

  async ngAfterViewInit():Promise<void>{
    const ThreeContainer:HTMLDivElement = this.DivReference.nativeElement;
    const ThreeRect = ThreeContainer.getBoundingClientRect();
    const D3Container:SVGSVGElement = this.SVGReference.nativeElement;
    const D3Rect = D3Container.getBoundingClientRect();

    this.Graphs.Initialize(this.SVGReference.nativeElement,D3Rect.width,D3Rect.height);
    Interactables_3D.InitializeScene(ThreeRect.height,ThreeRect.width,ThreeContainer);
    LayerHyperparametersInterface.Three_Reference = Interactables_3D;
    this.HyperParameters.D3_Reference = this.Graphs;
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

  HideShowTTV(checked:boolean):void{
    if(checked===true){
      this.Graphs.HideTTV();
    } else {
      this.Graphs.ShowTTV();
    }
  }

  CalculateLeft(i:number,modifier?:number):string{return `${i*(modifier===undefined?1:modifier)}%`}
  CalculateTop(i:number,modifier?:number):string{return `${i*(modifier===undefined?1:modifier)}%`}

  SetGraph(chosen:string):void{
    GraphManager.CleanSVG();
    this.Graphs.ReloadSVG(this.SVGReference.nativeElement);
    if(chosen === "Accuracy" || chosen === "Loss"){
      this.Graphs.DrawPredictionMultivariate(chosen,"Data",false);
    } else if(chosen === "Prediction"){
      if(this.Graphs.DataDescriptor["PredictionData"]["Data"].length == 4){
        this.Graphs.DrawBarChart("PredictionData","Data",true);
      } else {
        this.Graphs.DrawPredictionMultivariate("PredictionData","Data",true);
      }
    } else if(chosen === "Data"){
      this.HyperParameters.D3Rendering("ticker",this.SVGReference.nativeElement);
    }
    this.ChosenGraph=chosen;
  }

  async BuildRunArch():Promise<void>{
    this.Graphs.ResetDataDescriptor(["Loss","Accuracy","PredictionData"]);
    const ParameterizedRoute:string = `CreateModel?Hyperparams=${JSON.stringify(this.HyperParameters.Settings)}&LayerArgs=${JSON.stringify(this.LayerHyperParameters.LayerArgs)}`;
    const Data:PredictionData = await Utils.FetchRoute(ParameterizedRoute);
    this.Graphs.ParsePredictionResponse(Data);
    this.SetGraph("Prediction");
  }
}