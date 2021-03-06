import * as d3 from 'd3';
import * as chartXkcd from 'chart.xkcd';
import XY from './XY';
import './index.css';
import {win_sentence,loose_sentence} from './catch_phrase'
import { line } from 'd3';


declare const window: any;

const root = `${window.location.host}${window.location.pathname}`;
const websocketURL = `wss://${root}ws`;
// const socket = window.socket = new WebSocket('wss://quantumdraw.ci-nlesc.surf-hosted.nl/ws');
const socket = window.socket = new WebSocket('ws://localhost:8888/ws');

// const socket = window.socket = new WebSocket(websocketURL);

let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;

// let level = 0;
let userGuessAttemptNumber = 0;

let userscore = 0;
let aiscore = 0;
let showai = true;
let showhint = true;
let showsol = false;

let best_userscore = 0;
let best_aiscore = 0;

let startTime = 0;

// const HEIGHT = parseInt(d3.select('#canvas_view').style('width'), 10);
const WIDTH = parseInt(d3.select('#canvas_view').style('width'), 10) - 40;

console.log(screen.height)
console.log(d3.select('#top_bar_id').style('height'))
const banner_height = parseInt(d3.select('#banner').style('height'), 10);
const HEIGHT = (screen.height-banner_height)/2


const POTLINEWIDTH = 10;
const POTSTYLE = "#993366";

const STROKESTYLE = "#000000";
const LINEWIDTH = 5;

const ORISTYLE = "#808080";
const ORILINEWIDTH = 5;

const AISTYLE = "#077BA0";
const AILINEWIDTH = 1;

const HINTSTYLE = "#555555";
const HINTLINEWIDTH = 1

const SOLSTYLE = "#53B2B9";
const SOLLINEWIDTH = 10

canvas = document.createElement('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
document.getElementById('canvas_view').appendChild(canvas);
context = canvas.getContext("2d");

let harm_button: HTMLElement = document.getElementById('harm_button');
harm_button.addEventListener('click', () => sendResetMessage(0))

let morse_button: HTMLElement = document.getElementById('morse_button');
morse_button.addEventListener('click', () => sendResetMessage(1))

let double_button: HTMLElement = document.getElementById('double_button');
double_button.addEventListener('click', () => sendResetMessage(2))

let toggle_ai_button: HTMLElement = document.getElementById('toggle_ai_button');
toggle_ai_button.addEventListener('click', () => toggle_ai())

let toggle_ai_speed_button: HTMLElement = document.getElementById('toggle_ai_speed_button');
toggle_ai_speed_button.addEventListener('click', () => toggle_ai_speed())

let toggle_hint_button: HTMLElement = document.getElementById('toggle_hint_button');
toggle_hint_button.addEventListener('click', () => toggle_hint())

const strokes = [];
let potential = [];
let origin = [];
let aiguess = [];
let hint = [];
let sol = [];

let linechartData = {
    datasets: [{
        label: 'User scores',
        data: [],
    }, {
        label: 'AI scores',
        data: [],
    }],
};

// the hint filled 
var area = d3.area().context(context).y0(4*HEIGHT/5);

(window as any).strokes = strokes;
const curve = d3.curveBasis(context);
const redo = [];

// the main function 
function render() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    if (showsol) {
        for (const solStroke of sol) {
            context.beginPath();
            curve.lineStart();
            for (const point of solStroke) {
                curve.point(x(point[0]), y(point[1]));
            }
            if (solStroke.length === 1) curve.point(solStroke[0][0], solStroke[0][1]);
            curve.lineEnd();
            context.lineWidth = SOLLINEWIDTH;
            context.strokeStyle = SOLSTYLE;
            context.stroke();
        }
    }        
    
    if (showhint) {

        for (const hintStroke of hint) {
            context.beginPath();
            curve.lineStart();
            var arr_tmp = []
            for (const point of hintStroke) {
                curve.point(x(point[0]), y(point[1]));
                arr_tmp.push([x(point[0]), y(point[1])])
            }
            

            if (hintStroke.length === 1) curve.point(hintStroke[0][0], hintStroke[0][1]);
            curve.lineEnd();

            context.lineWidth = HINTLINEWIDTH;
            context.strokeStyle = HINTSTYLE;
            context.stroke();
            
            context.beginPath();
            area(arr_tmp);
            context.fillStyle = '#DFDFDF';
            context.strokeStyle = '#5A5B5B';
            context.fill();

        }
    }

    for (const oriStroke of origin) {
        context.beginPath();
        curve.lineStart();
        for (const point of oriStroke) {
            curve.point(x(point[0]), zeros(point[0]));
        }
        if (oriStroke.length === 1) curve.point(oriStroke[0][0], oriStroke[0][1]);
        curve.lineEnd();
        context.lineWidth = ORILINEWIDTH;
        context.strokeStyle = ORISTYLE;
        context.stroke();
    }

    for (const potentialStroke of potential) {
        context.beginPath();
        curve.lineStart();
        for (const point of potentialStroke) {
            curve.point(x(point[0]), y(point[1]));
        }
        if (potentialStroke.length === 1) curve.point(potentialStroke[0][0], potentialStroke[0][1]);
        curve.lineEnd();
        context.lineWidth = POTLINEWIDTH;
        context.strokeStyle = POTSTYLE;
        context.stroke();
    }

    if (showai) {
        for (const aiStroke of aiguess) {
            context.beginPath();
            curve.lineStart();
            for (const point of aiStroke) {
                curve.point(x(point[0]), y(point[1]));
            }
            if (aiStroke.length === 1) curve.point(aiStroke[0][0], aiStroke[0][1]);
            curve.lineEnd();
            context.lineWidth = AILINEWIDTH;
            context.strokeStyle = AISTYLE;
            context.stroke();
        }
    }



    for (const stroke of strokes) {
        context.beginPath();
        curve.lineStart();
        for (const point of stroke) {
            curve.point(point[0], point[1]);
        }
        if (stroke.length === 1) curve.point(stroke[0][0], stroke[0][1]);
        curve.lineEnd();
        context.lineWidth = LINEWIDTH;
        context.strokeStyle = STROKESTYLE;
        context.stroke();
    }

    // context.canvas.value = strokes;
    context.canvas.dispatchEvent(new CustomEvent("input"));
}

var zeros = d3.scaleLinear()
    .domain([1, -0.25])
    .range([4*HEIGHT/5, 4*HEIGHT/5]);


var x = d3.scaleLinear()
    .domain([-5, 5])
    .range([-1, WIDTH + 1]);

// what is that scale ? 
// with .domain([1,0]) the bottom of the harmonic
// oscillator pot doesnt show ....    
var y = d3.scaleLinear()
    .domain([1, -0.25])
    .range([-1, HEIGHT + 1]);


d3.select(context.canvas).call(d3.drag()
    .container(context.canvas)
    .subject(dragsubject)
    .on("end", () => {
        sendGuess(strokes[0].map(stroke => [x.invert(stroke[0]), y.invert(stroke[1])]));
    })
    .on("start drag", dragged)
    .on("start.render drag.render", render))

// Create a new empty stroke at the start of a drag gesture.
function dragsubject() {
    strokes.length = 0;
    const stroke = [];

    strokes.push(stroke);

    return stroke;
}

// Add to the stroke when dragging.
function dragged() {
    let newX = d3.event.x;
    const stroke = d3.event.subject;
    if (stroke) {
        let maxX = Math.max(...stroke.map(strokeSegment => strokeSegment[0]));
        if (newX > maxX) {
            stroke.push([d3.event.x, d3.event.y]);
        }
    }
}

function reset() {
    strokes.length = 0;
    sendResetMessage(0);
    userGuessAttemptNumber = 0;
    best_userscore = 0;
    best_aiscore = 0;
    linechartData = {
        datasets: [{
            label: 'User scores',
            data: [],
        }, {
            label: 'AI scores',
            data: [],
        }],
    };
    window.linechart.data = linechartData;

    // Clear and Rerender
    document.querySelector('.line-chart>g:first-child').innerHTML = '';
    window.linechart.render();

    render();
}

function clear_canvas() {
    userGuessAttemptNumber = 0;

    linechartData = {
        datasets: [{
            label: 'You',
            data: [],
        }, {
            label: 'AI',
            data: [],
        }],
    };
    window.linechart.data = linechartData;
    aiguess = []
    strokes = []
    hint = []
    sol = []

    // Clear and Rerender
    document.querySelector('.line-chart>g:first-child').innerHTML = '';
    window.linechart.render();

    render();
}

function toggle_ai() {
    showai = !showai
    render()
}

function toggle_hint() {
    showhint = !showhint
    render()
}

function toggle_ai_speed() {
    let message: Message = {
        type: 'speed',
        data: true
    };
    socket.send(JSON.stringify(message));
}

window.addEventListener('load', () => {
    reset();
});

function updateUserScore(time: number, value: number) {
    const userScoreP = d3.select('.userScoreP');
    const userAttemptP = d3.select('.userAttemptP');
    const userTimeP = d3.select('.userTimeP');

    if (userGuessAttemptNumber === 0) {
        startTime = time;
    }

    let displayTime = (time - startTime) / 1000;
    userGuessAttemptNumber++;

    userscore = value * 1000;
    if (userscore > best_userscore) {
        best_userscore = userscore
    }

    userScoreP.text("User score now: " + userscore.toString());
    userAttemptP.text("User attempt: " + userGuessAttemptNumber.toString());
    userTimeP.text("User time: " + displayTime.toString());

    linechartData.datasets[0].data.push({ x: displayTime, y: userscore });

    // Clear and Rerender
    document.querySelector('.line-chart>g:first-child').innerHTML = '';
    window.linechart.render();
    
}

function updateAIScore(time: number, value: number) {
    const aiscoreP = d3.select('.aiScoreP');

    let displayTime = (time - startTime) / 1000;

    aiscore = value * 1000;
    if (aiscore > best_aiscore) {
        best_aiscore = aiscore
    }
    aiscoreP.text("AI score now: " + aiscore.toString());

    linechartData.datasets[1].data.push({ x: displayTime, y: aiscore });
    document.querySelector('.line-chart>g:first-child').innerHTML = '';
    window.linechart.render();

}

// createScore();

//Add reset button
const button = document.createElement('button');
button.innerHTML = 'reset';
button.addEventListener('click', reset as any);
//document.body.appendChild(button);

socket.addEventListener('message', function (event) {
    const time = new Date().getTime();
    const parsedData = JSON.parse(event.data);
    const eventType = parsedData.type;

    if (eventType === 'potential') {
        potential = [parsedData.data];
        origin = [parsedData.data];
        render();

    } else if (eventType === 'ai_score') {
        if (userGuessAttemptNumber != 0) {
            updateAIScore(time, parsedData.score);
            aiguess = [parsedData.points];
            render();
        }

    } else if (eventType === 'user_score') {
        updateUserScore(time, parsedData.score);
        hint = [parsedData.points]
        render();

    } else if (eventType === 'game_over') {
        showai = true;
        showsol = true;
        sol = [parsedData.points];
        render();
        showModal();
    }
})

function showModal() {

    var modal = document.getElementById("myModal");

    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close_modal")[0];  

    // When the user clicks on <span> (x), close the modal
    span.onclick = function() {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    // window.onclick = function(event) {
    //     if (event.target == modal) {
    //         modal.style.display = "none";
    //     }
    // }

    var header = document.getElementById("modal_header");
    var footer = document.getElementById("modal_footer");
    var body = document.getElementById("modal_body");
    
    header.style.backgroundColor = "black"
    footer.style.backgroundColor = "black"

    

    if (best_aiscore > best_userscore){
        // change modal style
        header.style.backgroundColor = "#C41313"
        footer.style.backgroundColor = "#C41313"
        let iphrase = Math.floor(Math.random()*loose_sentence.length)
        body.innerHTML = loose_sentence[iphrase]
        modal.style.display = "block";
    }
    else {
        // change modal style
        header.style.backgroundColor = "#5cb85c"
        footer.style.backgroundColor = "#5cb85c"
        let iphrase = Math.floor(Math.random()*win_sentence.length)
        body.innerHTML = win_sentence[iphrase]
        modal.style.display = "block";
    }
}

interface Message {
    type: string;
    data: any;
}

function sendResetMessage(level: number = 0) {
    clear_canvas()
    let message: Message = {
        type: 'reset',
        data: level
    };
    socket.send(JSON.stringify(message));
    best_userscore = 0
    best_aiscore = 0
}

function sendGuess(data: Array<Array<number>>) {
    let message: Message = {
        type: 'guess',
        data: data
    };
    socket.send(JSON.stringify(message));
}

window.addEventListener('load', () => {
    const svg = document.querySelector('.line-chart');

    window.linechart = new chartXkcd.XY(
        svg, {
        // title: 'Your score VS AI score', // optional
        xLabel: 'Time in seconds', // optional
        yLabel: 'Score', // optional
        data: linechartData,
        options: { // optional
            xTickCount: 10,
            yTickCount: 10,
            dotSize: 1,
            showLine: true,
            legendPosition: chartXkcd.config.positionType.downRight,
            showLegend: false,
            unxkcdify: true,
        }
    });
    // console.log(canvas.height)
    // canvas.height = parseInt(d3.select('.line-chart').style('height'), 10);
    // console.log(canvas.height)
})

window.addEventListener("orientationchange", function () {
    window.location.reload();
});


