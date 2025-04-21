import * as d3 from 'd3';
interface DataStructure {
  close:number;
  high:number;
  low:number;
  open:number
  timestamp:string;
  colorscheme:string[];
}

export function MultivariateChart(
  SVG:d3.Selection<SVGSVGElement, unknown, null, undefined>, 
  Metric:number[][],
  W:number,
  H:number,
  color:string[][],
  Labels:string[],
  duration:number,
  CutOff:number
):void{
  const Variates:number = Metric.length-1;
  let Min = 0;
  let Max = 0;
  for(let i = 0; i<=Variates; i++){
    Min = Math.min(Min,...Metric[i]);
    Max = Math.max(Max,...Metric[i]);
  }
  const len:number = Metric[0].length;
  const PredictionCutOff = len-CutOff;
  const BaseColor = color[0];
  const PredictionColor = color[1];
  const X:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([0,len])
      .range([0,W]); 
  const XPredictionCutOff = X(PredictionCutOff);
  const Y:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([Min,Max])
      .rangeRound([H,0]);

  function MouseMoveNavigation(e:MouseEvent):void{
    let [x] = d3.pointer(e,e.target);
    x = Math.round(x);
    SVG.selectAll("#NavigationCircle").remove();
    SVG.selectAll("#NavigationText").remove();
    let PrevY = 0;
    let Modifier = 30; 
    for(let Index=0; Index<=Variates; Index++){
      if(Metric[Index][Math.round(X.invert(x))]!==undefined){
        const YValue = Metric[Index][Math.round(X.invert(x))];
        const YCord = Y(YValue);
        const Color = x>XPredictionCutOff?BaseColor:PredictionColor;
        if(PrevY !== 0 && Math.abs(PrevY-YCord) < 30){
          SVG.append("circle")
            .attr("cx",x)
            .attr("cy",YCord+Modifier)
            .attr("r",5)
            .attr("id","NavigationCircle")
            .attr("stroke",Color[Index]);
          SVG.append("text")
            .attr("x",x)
            .attr("y",YCord+Modifier)
            .text(`${Labels[Index]}: ${YValue}`)
            .attr("id","NavigationText")
            .attr("color",Color[Index])
            .attr("stroke",Color[Index]);
          PrevY = YCord+Modifier;
          Modifier += 30;

        } else {
          SVG.append("circle")
            .attr("cx",x)
            .attr("cy",YCord)
            .attr("r",5)
            .attr("id","NavigationCircle")
            .attr("stroke",Color);
          SVG.append("text")
            .attr("x",x)
            .attr("y",YCord)
            .text(`${Labels[Index]}: ${YValue}`)
            .attr("id","NavigationText")
            .attr("color",Color[Index])
            .attr("stroke",Color[Index]);
          PrevY = YCord;
        }
      }
    }
  }

  SVG.on('mousemove',(e:MouseEvent)=>{MouseMoveNavigation(e)})

  for(let TTV = 0; TTV <= Variates; TTV++){
      const G = SVG.append("g");
      for(let i = 0; i <= len-2; i++){
          const Color = i>PredictionCutOff?BaseColor:PredictionColor;
          G.append("line")
              .attr("x1",X(i))
              .attr("x2",X(i+1))
              .attr("y1",Y(Metric[TTV][i]))
              .attr("y2",Y(Metric[TTV][i]))
              .attr("stroke",Color[TTV])
              .transition()
                  .duration(duration*i)
                  .attr("y2",Y(Metric[TTV][i+1]));
      }
  }
  SVG.append("g")
    .attr("class","x-grid")
    .attr("transform",`translate(0,${H})`)
    .call(
      d3.axisBottom(X)
        .tickSize(-H)
    );
  SVG.append("g")
    .attr("class","y-grid")
    .call(
      d3.axisLeft(Y)
        .tickSize(-W)
    );
}

export function AccLossPlot(
  SVG:d3.Selection<SVGSVGElement, unknown, null, undefined>, 
  Metric:number[][],
  W:number,
  H:number,
  color:string[],
  Labels:string[],
  duration:number
):void{
  const Variates:number = Metric.length-1;
  let Min = 0;
  let Max = 0;
  for(let i = 0; i<=Variates; i++){
    Min = Math.min(Min,...Metric[i]);
    Max = Math.max(Max,...Metric[i]);
  }
  const len:number = Metric[0].length;

  const X:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([0,len])
      .range([0,W]); 
  const Y:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([Min,Max])
      .rangeRound([H,0]);

  function MouseMoveNavigation(e:MouseEvent):void{
    let [x] = d3.pointer(e,e.target);
    x = Math.round(x);
    SVG.selectAll("#NavigationCircle").remove();
    SVG.selectAll("#NavigationText").remove();
    let PrevY = 0;
    let Modifier = 30;
    for(let Index=0; Index<=Variates; Index++){
      if(Metric[Index][Math.round(X.invert(x))]!==undefined){
        const YValue = Metric[Index][Math.round(X.invert(x))];
        const YCord = Y(YValue);
        const Color = color[Index];
        if(PrevY !== 0 && Math.abs(PrevY-YCord) < 30){
          SVG.append("circle")
            .attr("cx",x)
            .attr("cy",YCord+Modifier)
            .attr("r",5)
            .attr("id","NavigationCircle")
            .attr("stroke",Color);
          SVG.append("text")
            .attr("x",x)
            .attr("y",YCord+Modifier)
            .text(`${Labels[Index]}: ${YValue}`)
            .attr("id","NavigationText")
            .attr("color",Color)
            .attr("stroke",Color);
          PrevY = YCord+Modifier;
          Modifier += 30;

        } else {
          SVG.append("circle")
            .attr("cx",x)
            .attr("cy",YCord)
            .attr("r",5)
            .attr("id","NavigationCircle")
            .attr("stroke",Color);
          SVG.append("text")
            .attr("x",x)
            .attr("y",YCord)
            .text(`${Labels[Index]}: ${YValue}`)
            .attr("id","NavigationText")
            .attr("color",Color)
            .attr("stroke",Color);
          PrevY = YCord;
        }
      }
    }
  }

  SVG.on('mousemove',(e:MouseEvent)=>{MouseMoveNavigation(e)})

  for(let TTV = 0; TTV <= Variates; TTV++){
      const G = SVG.append("g")
        .attr("stroke",color[TTV]);
      for(let i = 0; i <= len-2; i++){
          G.append("line")
              .attr("x1",X(i))
              .attr("x2",X(i+1))
              .attr("y1",Y(Metric[TTV][i]))
              .attr("y2",Y(Metric[TTV][i]))
              .attr("stroke",color[TTV])
              .transition()
                  .duration(duration*i)
                  .attr("y2",Y(Metric[TTV][i+1]));
      }
  }
  SVG.append("g")
    .attr("class","x-grid")
    .attr("transform",`translate(0,${H})`)
    .call(
      d3.axisBottom(X)
        .tickSize(-H)
    );
  SVG.append("g")
    .attr("class","y-grid")
    .call(
      d3.axisLeft(Y)
        .tickSize(-W)
    );
}

export function CandleStick(
    Data:DataStructure[],
    Reference:d3.Selection<SVGSVGElement, unknown, null, undefined>,
    Width:number,
    Height:number
):void{

    const BarGroup = Reference.append("g");
    let height:number = 0;
    const len:number = Data.length;

    const Min:number = Math.min(...Data.map(DataPoint=>DataPoint.low));
    const Max:number = Math.max(...Data.map(DataPoint=>DataPoint.high));

    const Y:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([Min,Max])
      .rangeRound([Height,0]);

    const X:d3.ScaleLinear<number, number, never> = d3
      .scaleLinear()
      .domain([0,len])
      .range([0,Width]);

    for(let i = 0; i<Data.length; i++){
      height = Data[i].open-Data[i].close;
      BarGroup.append("rect")
        .attr("x",X(i)+10)//starting x coordinate
        .attr("y",Data[i].open-height)//open price scaled to Y axis
        .attr("width",5)//starting x + bar_width modifier
        .attr("height",Math.abs(height))//
        .attr("fill",height>0?"red":"green");
    }

    Reference.append("g")
    .attr("class","x-grid")
    .attr("transform",`translate(0,${Height})`)
    .call(
      d3.axisBottom(X)
        .tickSize(-Height)
    );
    Reference.append("g")
      .attr("class","y-grid")
      .call(
        d3.axisLeft(Y)
          .tickSize(-Width)
      );
  }