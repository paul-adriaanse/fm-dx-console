#!/usr/bin/env node
//
// (c) Bkram 2024 
// Console client for https://github.com/NoobishSVK/fm-dx-webserver

// Import necessary libraries
const blessed = require('reblessed'); // Library for creating terminal-based UI
const { spawn } = require('child_process');
const WebSocket = require('ws'); // WebSocket library for communication
const argv = require('minimist')(process.argv.slice(2)); // Library for parsing command-line arguments

// Check if required arguments are provided
if (!argv.url) {
    console.error('Usage: node fm-dx-console.js --url <websocket_address>');
    process.exit(1);
}

// Declare websocketAudioAddress variable outside of the scope
let websocketAudioAddress;

// Extract websocket address from command line arguments
const websocketAddress = argv.url;

// Check if the URL starts with 'ws://'
if (websocketAddress.startsWith('ws://')) {
    // Replace any port number with 8081
    websocketAudioAddress = websocketAddress.replace(/:\d+$/, ':8081');
} else if (websocketAddress.startsWith('wss://')) {
    // Append "/stream/" to the URL for wss:// addresses
    websocketAudioAddress = websocketAddress + 'stream/';
} else {
    console.log('URL does not start with ws:// or wss://. No modification needed.');
    process.exit(1); // Exit with a non-zero status code to indicate an error
}

// Prepare for audio streaming
let isPlaying = false; // Flag to track if audio is currently playing
const playMP3FromWebSocket = require('./audiostream');
const player = playMP3FromWebSocket(websocketAudioAddress);

// Create a Blessed screen
const screen = blessed.screen({
    smartCSR: true,
});

// Function to check terminal dimensions
function checkTerminalSize() {
    const { cols, rows } = screen.program;
    if (cols < 80 || rows < 24) {
        console.error('Terminal size is smaller than 80x24. Exiting...');
        process.exit(1);
    }
}

// Check terminal size initially
checkTerminalSize();

// Create a title element
const title = blessed.text({
    top: 0,
    left: 0,
    width: '100%', // Set width to occupy the full width of the screen
    content: `fm-dx-console by Bkram`,
    tags: true,
    style: {
        fg: 'white',
        bg: 'blue',
        bold: true // Make the title bold
    },
});

// Create a clock widget
const clock = blessed.text({
    top: 0,
    right: 0,
    width: '10%', // Set width to occupy 20% of the screen
    align: 'right',
    content: '{bold}00:00{/bold}', // Initial placeholder content
    tags: true,
    style: {
        fg: 'white',
        bg: 'blue'
    },
});

// Create a box to display main content
const tunerBox = blessed.box({
    top: 1, // Leave space for the title
    left: 0,
    width: '50%', // Occupy 30% of the screen width
    height: '40%', // Reduce height to accommodate the additional view below
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: '#f0f0f0' } },
});

// Create a box for City, Distance, and Station
const stationBox = blessed.box({
    top: 1,
    left: '50%', // Position it to the right of the tuner box
    width: '50%', // Occupy 60% of the screen width
    height: '40%', // Occupy 40% of the screen height
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: '#f0f0f0' } },
});

// Create a box for RT0 and RT1
const rtBox = blessed.box({
    top: '45%', // Position it below the main box
    left: 'center',
    width: '99%', // Occupy 100% of the screen width
    height: '22%', // Occupy 25% of the screen height
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: '#f0f0f0' } },
});

// Create a userbox
const userBox = blessed.box({
    top: '65%', // Set top position below the rtBox
    left: "50%",
    width: '50%', // Occupy 100% of the screen width
    height: '20%', // Occupy 15% of the screen height
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: '#f0f0f0' } },
});

// Create a signalbox
const signalBox = blessed.box({
    top: '65%', // Set top position below the rtBox
    left: 0,
    width: '50%', // Occupy 100% of the screen width
    height: '20%', // Occupy 15% of the screen height
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: '#f0f0f0' } },
    content: "{center}{bold}Signal{/bold}{/center}"
});

// Create the signal meter `progress` bar
const progressBar = blessed.progressbar({
    parent: signalBox,
    top: '72%',
    left: 2,
    width: '46%',
    height: 1,
    tags: true,
    style: {
        bar: {
            bg: 'green' // Adjust color as needed
        }
    },
    filled: 0, // Set initial filled amount (0 - 100)

});

// Create a help box
const help = blessed.box({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '60%',
    border: 'line',
    style: {
        fg: 'white',
        // bg: 'black',
        border: {
            fg: '#f0f0f0'
        }
    },
    content: `{center}{bold}Help{/bold}{/center}
Press keys:
'q' to decrease by 1000 kHz
'w' to increase by 1000 kHz
'z' to decrease by 10 kHz
'x' to increase by 10 kHz
'a' to decrease by 100 kHz
's' to increase 100 kHz
'r' to refresh
't' to set frequency
'p' to play audio
'Esc' to quit
'h' to toggle this help
`,
    tags: true,
    hidden: true
});

// Create a title bar for the bottom
const titleBottom = blessed.text({
    bottom: 0,
    left: 0,
    width: '100%',
    align: 'center',
    content: `Connected to server on {bold}${websocketAddress}{/bold} press \`h\` for help`,
    tags: true,
    style: {
        fg: 'white',
        bg: 'blue',
        bold: true
    },
});

// Append title, clock, main box, help box, rt box, and cityDistanceStation box to the screen
screen.append(title);
screen.append(clock);
screen.append(tunerBox);
screen.append(stationBox);
screen.append(rtBox);
screen.append(signalBox);
screen.append(userBox);
screen.append(progressBar);
screen.append(help);
screen.append(titleBottom);

// Function to do some padding
function padStringWithSpaces(text, totalLength) {
    const spacesToAdd = totalLength - text.length;
    if (spacesToAdd <= 0) return text; // No padding needed if text length is equal or greater than totalLength
    return ' ' + text + ' '.repeat(spacesToAdd);
}

// Function to update the main box content
function updateTunerBox(content) {
    tunerBox.setContent(content);
    screen.render();
}

// Function to update the RT box content
function updateRTBox(rt0, rt1) {
    rtBox.setContent(`{center}{bold}Radiotext{/bold}{/center}\n{center}${rt0.trim()}{/center}\n{center}${rt1.trim()}{/center}`);
    screen.render();
}

// Function to update the StationBox
function updateStationBox(city, distance, station, power, country, polarization, azimuth) {
    const padLength = 10;
    stationBox.setContent(
        `{center}{bold}Station Data{/bold}{/center}\n` +
        `${padStringWithSpaces("Station:", padLength)}${station}\n` +
        `${padStringWithSpaces("Location:", padLength)}${city ? city + ", " + country : ""}\n` +
        `${padStringWithSpaces("Distance:", padLength)}${distance ? distance + " km" : ""}\n` +
        `${padStringWithSpaces("Power:", padLength)}${power ? power + " kW " + "[" + polarization + "]" : ""}\n` +
        `${padStringWithSpaces("Azimuth:", padLength)}${azimuth ? azimuth + "°" : ""}`);
    screen.render();
}

// Function to update the userBox
function updateUserBox(users) {
    userBox.setContent(`{center}{bold}Users{/bold}{/center}\n Users: ${users}`);
    screen.render();
}

// Update clock function
function updateClock() {
    const now = new Date();
    const hours = ('0' + now.getHours()).slice(-2); // Get hours in 2-digit format
    const minutes = ('0' + now.getMinutes()).slice(-2); // Get minutes in 2-digit format
    const timeString = `${hours}:${minutes}`;
    clock.setContent(`{right}{bold}${timeString}{/bold}{/right}`);
    screen.render();
}

// Function to scale the progress bar value
function scaleValue(value) {
    const maxvalue = 100; //actual max tef is 130, but 100 seems to be a better option
    // Ensure value is within range [0, maxvalue]
    value = Math.max(0, Math.min(maxvalue, value));
    // Scale value to fit within range [0, 100]
    return Math.floor((value / maxvalue) * 100);
}

// Function to update the signal meter
function updateSignal(signal) {
    progressBar.filled = scaleValue(signal);
}

// Update clock every second
setInterval(updateClock, 1000);

// Initialize JSON data variable
let jsonData = null;

// WebSocket setup
const ws = new WebSocket(websocketAddress + "text");

// WebSocket event handlers
ws.on('open', function () {
    updateTunerBox('WebSocket connection established');
});

ws.on('message', function (data) {
    try {
        jsonData = JSON.parse(data);
        const padLength = 11;
        const content =
            `{center}{bold}Tuner{/bold}{/center}\n` +
            `${padStringWithSpaces("Frequency:", padLength)}${jsonData.freq} Mhz\n` +
            `${padStringWithSpaces("Signal:", padLength)}${jsonData.signal} dBf\n` +
            `${padStringWithSpaces("Mode:", padLength)}${jsonData.st ? "Stereo" : "Mono"}\n` +
            `${padStringWithSpaces("RDS PS:", padLength)}${jsonData.ps}\n` +
            `${padStringWithSpaces("RDS PI:", padLength)}${jsonData.pi}\n`;

        updateTunerBox(content);
        updateSignal(jsonData.signal);
        if (jsonData && jsonData.txInfo) {
            updateStationBox(jsonData.txInfo.city, jsonData.txInfo.distance, jsonData.txInfo.station, jsonData.txInfo.erp, jsonData.txInfo.itu, jsonData.txInfo.pol, jsonData.txInfo.azimuth);
        }
        if (jsonData && jsonData.rt0 !== undefined && jsonData.rt1 !== undefined) {
            updateRTBox(jsonData.rt0, jsonData.rt1);
        }
        if (jsonData && jsonData.txInfo) {
            updateStationBox(jsonData.txInfo.city, jsonData.txInfo.distance, jsonData.txInfo.station, jsonData.txInfo.erp, jsonData.txInfo.itu, jsonData.txInfo.pol, jsonData.txInfo.azimuth);
        }
        if (jsonData && jsonData.users !== undefined) {
            updateUserBox(jsonData.users);
        }

    } catch (error) {
        console.error('Error parsing JSON:', error);
    }
});

ws.on('close', function () {
    updateTunerBox('WebSocket connection closed');
});

// Listen for key events
screen.on('keypress', function (ch, key) {
    if (key.full === 's') { // Decrease frequency by 100 kHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) + 100;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'a') { // Increase frequency by 100 kHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) - 100;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'q') { // Decrease frequency by 1 MHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) - 1000;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'w') { // Increase frequency by 1 MHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) + 1000;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'z') { // Decrease frequency by 0.01 MHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) - 10;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'x') { // Increase frequency by 0.01 MHz
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000) + 10;
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 'r') { // Refresh by setting the frequency again
        if (jsonData && jsonData.freq) {
            const newFreq = (jsonData.freq * 1000);
            ws.send(`T${newFreq}`);
        }
    } else if (key.full === 't') { // Set frequency
        screen.saveFocus();
        // Create a dialog box to get the frequency from the user
        const dialog = blessed.prompt({
            top: 'center',
            left: 'center',
            width: '25%',
            height: 'shrink',
            border: 'line',
            style: {
                fg: 'white',
                // bg: 'black',
                border: {
                    fg: '#f0f0f0'
                }
            },
            label: ' Enter frequency in MHz: ',
            tags: true
        });

        screen.append(dialog);
        screen.render();

        dialog.input('', '', function (err, value) {
            if (!err) {
                const newFreq = parseFloat(value) * 1000; // Convert MHz to kHz
                ws.send(`T${newFreq}`);
            }
            dialog.destroy();
            screen.restoreFocus();
            screen.render();
        });
    } else if (key.full === 'h') { // Toggle help visibility
        if (help.hidden) {
            help.show();
        } else {
            help.hide();
        }
    } else if (key.full === 'p') { // Toggle playback
        if (isPlaying) {
            player.stop(); // Stop playback if currently playing
            isPlaying = false;
        } else {
            player.play(); // Start playback if not playing
            isPlaying = true;
        }
    }
});

// Quit on Escape, q, or Control-C
screen.key(['escape', 'C-c'], function () {
    process.exit(0);
});

// Update clock initially
updateClock();
