// --- Global Variables ---
let scene, camera, renderer; // Three.js variables
let d3Svg, d3ChartGroup, d3XScale, d3YScale, d3LineGenerator, d3RegressionLineGenerator; // D3.js variables
let climateData = []; // Stores the simulated climate data
let regressionResult = { slope: 0, intercept: 0 }; // Stores the result of the linear regression
let isDragging = false; // For camera control
let previousMousePosition = { x: 0, y: 0 }; // For camera control

// --- Configuration Parameters ---
const CHART_MARGIN = { top: 20, right: 30, bottom: 40, left: 50 };
const THREE_JS_POINT_SIZE = 0.5;
const THREE_JS_LINE_WIDTH = 0.1;

// --- DOM Elements ---
const threeJsCanvas = document.getElementById('threeJsCanvas');
const d3Chart = document.getElementById('d3Chart');
const trendSlider = document.getElementById('trendSlider');
const noiseSlider = document.getElementById('noiseSlider');
const yearsSlider = document.getElementById('yearsSlider');
const trendValueSpan = document.getElementById('trendValue');
const noiseValueSpan = document.getElementById('noiseValue');
const yearsValueSpan = document.getElementById('yearsValue');

// --- Initialization Function ---
window.onload = function () {
    initThreeJs();
    initD3Js();
    setupEventListeners();
    // Generate initial data and update visualizations
    generateAndUpdate();
    animate(); // Start the Three.js animation loop
};

/**
 * Initializes the Three.js scene, camera, and renderer.
 * Sets up basic lighting and a grid helper.
 */
function initThreeJs() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe2e8f0); // Match canvas background

    // Camera
    camera = new THREE.PerspectiveCamera(75, threeJsCanvas.clientWidth / threeJsCanvas.clientHeight, 0.1, 1000);
    camera.position.set(50, 40, 70); // Adjusted camera position for better view
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: threeJsCanvas, antialias: true });
    renderer.setSize(threeJsCanvas.clientWidth, threeJsCanvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Grid Helper (for better 3D context)
    const gridHelper = new THREE.GridHelper(100, 10); // Size 100, 10 divisions
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Axis Helper (X: red, Y: green, Z: blue)
    const axesHelper = new THREE.AxesHelper(50); // Size 50
    scene.add(axesHelper);

    // Handle window resizing for Three.js canvas
    window.addEventListener('resize', onWindowResizeThreeJs, false);
}

/**
 * Handles window resizing for the Three.js canvas.
 * Updates camera aspect ratio and renderer size.
 */
function onWindowResizeThreeJs() {
    camera.aspect = threeJsCanvas.clientWidth / threeJsCanvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threeJsCanvas.clientWidth, threeJsCanvas.clientHeight);
}

/**
 * Initializes the D3.js SVG container, scales, and line generators.
 */
function initD3Js() {
    const containerWidth = d3Chart.clientWidth;
    const containerHeight = d3Chart.clientHeight;

    d3Svg = d3.select(d3Chart)
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

    d3ChartGroup = d3Svg.append("g")
        .attr("transform", `translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`);

    // X scale (for years)
    d3XScale = d3.scaleLinear()
        .range([0, containerWidth - CHART_MARGIN.left - CHART_MARGIN.right]);

    // Y scale (for temperature)
    d3YScale = d3.scaleLinear()
        .range([containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom, 0]);

    // Line generator for climate data
    d3LineGenerator = d3.line()
        .x(d => d3XScale(d.year))
        .y(d => d3YScale(d.temperature));

    // Line generator for regression line
    d3RegressionLineGenerator = d3.line()
        .x(d => d3XScale(d.year))
        .y(d => d3YScale(d.predictedTemp));

    // Append initial axes (will be updated later)
    d3ChartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom})`);

    d3ChartGroup.append("g")
        .attr("class", "y-axis");

    // Append initial data path (will be updated later)
    d3ChartGroup.append("path")
        .attr("class", "line");

    // Append initial regression path (will be updated later)
    d3ChartGroup.append("path")
        .attr("class", "regression-line");

    // Add X-axis label
    d3ChartGroup.append("text")
        .attr("class", "x-axis-label")
        .attr("x", (containerWidth - CHART_MARGIN.left - CHART_MARGIN.right) / 2)
        .attr("y", containerHeight - CHART_MARGIN.bottom / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "0.9rem")
        .style("fill", "#475569")
        .text("Year");

    // Add Y-axis label
    d3ChartGroup.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -CHART_MARGIN.left + 15)
        .attr("x", -(containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom) / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "0.9rem")
        .style("fill", "#475569")
        .text("Temperature Anomaly (°C)");

    // Handle window resizing for D3.js chart
    window.addEventListener('resize', onWindowResizeD3Js, false);
}

/**
 * Handles window resizing for the D3.js chart.
 * Updates SVG dimensions and redraws the chart.
 */
function onWindowResizeD3Js() {
    const containerWidth = d3Chart.clientWidth;
    const containerHeight = d3Chart.clientHeight;

    d3Svg.attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`);

    d3XScale.range([0, containerWidth - CHART_MARGIN.left - CHART_MARGIN.right]);
    d3YScale.range([containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom, 0]);

    d3ChartGroup.select(".x-axis")
        .attr("transform", `translate(0,${containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom})`)
        .call(d3.axisBottom(d3XScale).tickFormat(d3.format("d")));

    d3ChartGroup.select(".y-axis")
        .call(d3.axisLeft(d3YScale));

    // Update axis labels positions
    d3ChartGroup.select(".x-axis-label")
        .attr("x", (containerWidth - CHART_MARGIN.left - CHART_MARGIN.right) / 2)
        .attr("y", containerHeight - CHART_MARGIN.bottom / 2);

    d3ChartGroup.select(".y-axis-label")
        .attr("x", -(containerHeight - CHART_MARGIN.top - CHART_MARGIN.bottom) / 2);

    // Redraw lines
    updateD3Chart();
}

/**
 * Sets up event listeners for sliders and mouse interaction for camera control.
 */
function setupEventListeners() {
    trendSlider.addEventListener('input', () => {
        trendValueSpan.textContent = trendSlider.value;
        generateAndUpdate();
    });
    noiseSlider.addEventListener('input', () => {
        noiseValueSpan.textContent = noiseSlider.value;
        generateAndUpdate();
    });
    yearsSlider.addEventListener('input', () => {
        yearsValueSpan.textContent = yearsSlider.value;
        generateAndUpdate();
    });

    // Mouse controls for Three.js camera rotation
    threeJsCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    threeJsCanvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Rotate around Y-axis (horizontal drag)
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.005);
        // Rotate around X-axis (vertical drag) - careful not to flip
        camera.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.005);

        camera.lookAt(0, 0, 0); // Always look at the origin
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    threeJsCanvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    threeJsCanvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
}

/**
 * Generates synthetic climate data based on user input from sliders.
 * @param {number} numYears - The number of years to simulate.
 * @param {number} baseTemp - The starting temperature anomaly.
 * @param {number} trendPerDecade - The warming trend per decade.
 * @param {number} noiseLevel - The amount of random noise in the data.
 * @returns {Array<Object>} An array of objects, each with 'year' and 'temperature'.
 */
function generateClimateData(numYears, baseTemp, trendPerDecade, noiseLevel) {
    const data = [];
    for (let i = 0; i < numYears; i++) {
        const year = 1900 + i; // Start from a historical year
        // Calculate temperature based on base, trend, and noise
        const temperature = baseTemp + (i / 10) * trendPerDecade + (Math.random() - 0.5) * noiseLevel;
        data.push({ year, temperature });
    }
    return data;
}

/**
 * Performs a simple linear regression on the given data to detect a trend.
 * This serves as a conceptual "AI" model for trend detection.
 * @param {Array<Object>} data - An array of objects with 'year' and 'temperature'.
 * @returns {Object} An object containing the calculated 'slope' and 'intercept'.
 */
function performSimpleDetection(data) {
    let n = data.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    // Calculate sums needed for linear regression formula
    for (let i = 0; i < n; i++) {
        let x = data[i].year;
        let y = data[i].temperature;
        sumX += x;
        sumY += y;
        sumXY += (x * y);
        sumXX += (x * x);
    }

    // Calculate slope (m) and intercept (b) using the least squares method
    const denominator = (n * sumXX - sumX * sumX);
    let slope = 0;
    let intercept = 0;

    if (denominator !== 0) { // Avoid division by zero
        slope = (n * sumXY - sumX * sumY) / denominator;
        intercept = (sumY - slope * sumX) / n;
    }

    return { slope, intercept };
}

/**
 * Generates new climate data, performs detection, and updates both visualizations.
 */
function generateAndUpdate() {
    const numYears = parseInt(yearsSlider.value);
    const baseTemp = 0; // Starting anomaly at 0
    const trendPerDecade = parseFloat(trendSlider.value);
    const noiseLevel = parseFloat(noiseSlider.value);

    climateData = generateClimateData(numYears, baseTemp, trendPerDecade, noiseLevel);
    regressionResult = performSimpleDetection(climateData);

    updateThreeJsVisualization();
    updateD3Chart();
}

/**
 * Updates the Three.js scene with new data points and the regression line.
 */
function updateThreeJsVisualization() {
    // Clear existing data points and lines from the scene
    while (scene.children.length > 3) { // Keep grid, axes, lights
        scene.remove(scene.children[scene.children.length - 1]);
    }

    const minYear = d3.min(climateData, d => d.year);
    const maxYear = d3.max(climateData, d => d.year);
    const minTemp = d3.min(climateData, d => d.temperature);
    const maxTemp = d3.max(climateData, d => d.temperature);

    // Create scales for mapping data to Three.js coordinates
    // Z-axis for year, Y-axis for temperature, X-axis for arbitrary spread (or 0)
    const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([-40, 40]);
    const yScale = d3.scaleLinear().domain([minTemp - 1, maxTemp + 1]).range([-30, 30]); // Add padding for y-axis
    const zScale = d3.scaleLinear().domain([minYear, maxYear]).range([-40, 40]);

    // Add data points
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const pointColor = new THREE.Color(0x3b82f6); // blue-500

    climateData.forEach(d => {
        positions.push(xScale(d.year), yScale(d.temperature), 0); // X, Y, Z (Z is 0 for 2D-like plot)
        colors.push(pointColor.r, pointColor.g, pointColor.b);
    });

    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointsMaterial = new THREE.PointsMaterial({
        size: THREE_JS_POINT_SIZE,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);

    // Add regression line
    const regressionLineGeometry = new THREE.BufferGeometry();
    const regressionLinePositions = [];
    const regressionLineColor = new THREE.Color(0xdc2626); // red-600

    // Generate points for the regression line
    const linePoints = [];
    for (let i = 0; i < climateData.length; i++) {
        const year = climateData[i].year;
        const predictedTemp = regressionResult.slope * year + regressionResult.intercept;
        linePoints.push(new THREE.Vector3(xScale(year), yScale(predictedTemp), 0));
    }

    regressionLineGeometry.setFromPoints(linePoints);
    const regressionLineMaterial = new THREE.LineBasicMaterial({
        color: regressionLineColor,
        linewidth: THREE_JS_LINE_WIDTH // Note: linewidth is not widely supported in WebGL, use LineSegments for thicker lines
    });
    const regressionLine = new THREE.Line(regressionLineGeometry, regressionLineMaterial);
    scene.add(regressionLine);
}

/**
 * Updates the D3.js chart with new data and the regression line.
 */
function updateD3Chart() {
    const containerWidth = d3Chart.clientWidth;
    const containerHeight = d3Chart.clientHeight;

    // Update scales based on current data
    d3XScale.domain(d3.extent(climateData, d => d.year));
    d3YScale.domain([d3.min(climateData, d => d.temperature) - 0.5, d3.max(climateData, d => d.temperature) + 0.5]); // Add some padding

    // Update axes
    d3ChartGroup.select(".x-axis")
        .transition().duration(500)
        .call(d3.axisBottom(d3XScale).tickFormat(d3.format("d")));

    d3ChartGroup.select(".y-axis")
        .transition().duration(500)
        .call(d3.axisLeft(d3YScale));

    // Update data line
    d3ChartGroup.select(".line")
        .datum(climateData)
        .transition().duration(500)
        .attr("d", d3LineGenerator);

    // Prepare data for regression line
    const regressionLineData = climateData.map(d => ({
        year: d.year,
        predictedTemp: regressionResult.slope * d.year + regressionResult.intercept
    }));

    // Update regression line
    d3ChartGroup.select(".regression-line")
        .datum(regressionLineData)
        .transition().duration(500)
        .attr("d", d3RegressionLineGenerator);
}

/**
 * The Three.js animation loop.
 */
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
