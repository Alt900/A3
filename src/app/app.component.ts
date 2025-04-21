import { Component  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Utils } from './utils';

import { InteractiveArchitectureComponent } from './interactive-architecture/interactive-architecture.component';
interface DataStructure {
  close:number;
  high:number;
  low:number;
  open:number
  timestamp:string;
  volume:number; 
  colorscheme:string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    InteractiveArchitectureComponent,
    CommonModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {
  CandlestickData!:DataStructure[];
  AvailableTickers!:string[];

  HandleIncomingData(payload:any){
    this.CandlestickData = payload as DataStructure[];
  }

  ngOnInit():void{
    Utils.FetchRoute("GetTickers")
    .then(async (Result)=>{
      this.AvailableTickers=Result;
    });
  }
  title = 'Peek';
}
