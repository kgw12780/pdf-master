const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

// DOM Elements
const pdfContainer = document.getElementById('pdf-container');
const toolbar = document.getElementById('toolbar');
const styleToolbar = document.getElementById('style-toolbar');
const toolIndicator = document.querySelector('.tool-indicator');
const loadingIndicator = document.getElementById('loading-indicator');
const drawColorPicker = document.getElementById('draw-color-picker');
const drawWidthPicker = document.getElementById('draw-width-picker');

// State variables
let pdfDoc = null;
let currentPage = 1;
let totalPages = 1;
let scale = 1.5;
let annotations = [];
let undoStack = [];
let redoStack = [];
let currentTool = 'select';
let isDrawing = false;
let isHighlighting = false;
let drawCanvas, drawCtx;
let highlightCanvas, highlightCtx;
let currentEditable = null;
let selectedAnnotation = null;
let isResizing = false;
let resizeStartX, resizeStartY;
let resizeStartWidth, resizeStartHeight;
let lastX, lastY;
let drawingColor = '#000000';
let drawingLineWidth = 2;
let highlightColor = 'rgba(255, 255, 0, 0.5)';
let highlightLineWidth = 15;
let currentPath = null;
let canvasWidth, canvasHeight;

// Tool buttons
const selectToolBtn = document.getElementById('select-tool');
const textToolBtn = document.getElementById('text-tool');
const drawToolBtn = document.getElementById('draw-tool');
const highlightToolBtn = document.getElementById('highlight-tool');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const downloadBtn = document.getElementById('download-btn');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');

// Color options
const highlightColorOptions = [
    {color: 'rgba(255, 255, 0, 0.5)', name: 'Yellow'},
    {color: 'rgba(0, 255, 0, 0.5)', name: 'Green'},
    {color: 'rgba(0, 0, 255, 0.5)', name: 'Blue'},
    {color: 'rgba(255, 0, 0, 0.5)', name: 'Red'}
];

// Drawing tools
const drawingTools = [
    {name: 'pen', icon: 'fa-pen', lineWidth: 2, cursor: 'cursor-pen'},
    {name: 'marker', icon: 'fa-marker', lineWidth: 8, cursor: 'cursor-marker'},
    {name: 'pencil', icon: 'fa-pencil-alt', lineWidth: 1, cursor: 'cursor-pencil'}
];

const highlightTools = [
    {name: 'highlight-pen', icon: 'fa-pen', lineWidth: 8, cursor: 'cursor-highlight'},
    {name: 'highlight-marker', icon: 'fa-marker', lineWidth: 15, cursor: 'cursor-highlight'},
    {name: 'highlight-pencil', icon: 'fa-pencil-alt', lineWidth: 5, cursor: 'cursor-highlight'}
];

let currentDrawingTool = 'pen';
let currentHighlightTool = 'highlight-marker';

// Style toolbar drag functionality
let isDraggingToolbar = false;
let toolbarStartX, toolbarStartY;

// Initialize the application
function init() {
    setupEventListeners();
    loadPDF();
    
    // Improve drawing performance
    if (drawCanvas) {
        drawCanvas.style.willChange = 'contents';
    }
    if (highlightCanvas) {
        highlightCanvas.style.willChange = 'contents';
    }
}

function setupEventListeners() {
    // Tool selection
    selectToolBtn.addEventListener('click', () => setCurrentTool('select'));
    textToolBtn.addEventListener('click', () => setCurrentTool('text'));
    drawToolBtn.addEventListener('click', () => setCurrentTool('draw'));
    highlightToolBtn.addEventListener('click', () => setCurrentTool('highlight'));
    
    // Page navigation
    prevPageBtn.addEventListener('click', goToPreviousPage);
    nextPageBtn.addEventListener('click', goToNextPage);
    
    // Actions
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    saveBtn.addEventListener('click', saveAnnotations);
    clearBtn.addEventListener('click', clearCurrentPage);
    downloadBtn.addEventListener('click', downloadEditedPDF);
    
    // Style toolbar
    document.getElementById('btn-bold').addEventListener('click', () => applyStyle('bold'));
    document.getElementById('btn-italic').addEventListener('click', () => applyStyle('italic'));
    document.getElementById('btn-underline').addEventListener('click', () => applyStyle('underline'));
    document.getElementById('font-size').addEventListener('change', (e) => applyStyle('fontSize', e.target.value));
    document.getElementById('font-family').addEventListener('change', (e) => applyStyle('fontName', e.target.value));
    document.getElementById('font-color').addEventListener('change', (e) => applyStyle('foreColor', e.target.value));
    
    // Color picker
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelector('.color-option.selected').classList.remove('selected');
            this.classList.add('selected');
            drawingColor = this.dataset.color;
            if (currentTool === 'highlight') {
                highlightColor = this.dataset.color;
            }
        });
    });
    
    // Line width picker
    document.querySelectorAll('.line-width-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelector('.line-width-option.selected').classList.remove('selected');
            this.classList.add('selected');
            const width = parseInt(this.dataset.width);
            drawingLineWidth = width;
            if (currentTool === 'highlight') {
                highlightLineWidth = width * 3; // Highlight is thicker
            }
        });
    });
    
    // Drawing tools
    const drawingToolsContainer = document.getElementById('drawing-tools');
    drawingTools.forEach(tool => {
        const toolDiv = document.createElement('div');
        toolDiv.className = `drawing-tool ${tool.name === 'pen' ? 'selected' : ''}`;
        toolDiv.dataset.tool = tool.name;
        toolDiv.innerHTML = `<i class="fas ${tool.icon}"></i>`;
        toolDiv.title = tool.name.charAt(0).toUpperCase() + tool.name.slice(1);
        toolDiv.addEventListener('click', function() {
            document.querySelector('.drawing-tool.selected').classList.remove('selected');
            this.classList.add('selected');
            currentDrawingTool = this.dataset.tool;
            drawingLineWidth = drawingTools.find(t => t.name === currentDrawingTool).lineWidth;
            updateCursor();
        });
        drawingToolsContainer.appendChild(toolDiv);
    });
    
    // Highlight tools
    const highlightToolsContainer = document.getElementById('highlight-tools');
    highlightTools.forEach(tool => {
        const toolDiv = document.createElement('div');
        toolDiv.className = `drawing-tool ${tool.name === 'highlight-marker' ? 'selected' : ''}`;
        toolDiv.dataset.tool = tool.name;
        toolDiv.innerHTML = `<i class="fas ${tool.icon}"></i>`;
        toolDiv.title = tool.name.replace('highlight-', '').charAt(0).toUpperCase() + 
                        tool.name.replace('highlight-', '').slice(1);
        toolDiv.addEventListener('click', function() {
            document.querySelectorAll('#highlight-tools .drawing-tool.selected').forEach(el => {
                el.classList.remove('selected');
            });
            this.classList.add('selected');
            currentHighlightTool = this.dataset.tool;
            highlightLineWidth = highlightTools.find(t => t.name === currentHighlightTool).lineWidth;
            updateCursor();
        });
        highlightToolsContainer.appendChild(toolDiv);
    });
    
    // Style toolbar drag handle
    const dragHandle = styleToolbar.querySelector('.drag-handle');
    dragHandle.addEventListener('mousedown', (e) => {
        isDraggingToolbar = true;
        toolbarStartX = e.clientX - styleToolbar.offsetLeft;
        toolbarStartY = e.clientY - styleToolbar.offsetTop;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingToolbar) {
            styleToolbar.style.left = (e.clientX - toolbarStartX) + 'px';
            styleToolbar.style.top = (e.clientY - toolbarStartY) + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDraggingToolbar = false;
    });
    
    // Hide toolbar when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (!styleToolbar.contains(e.target) && !(currentEditable && currentEditable.contains(e.target))) {
            hideStyleToolbar();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            redo();
        }
        // Delete selected annotation
        if (e.key === 'Delete' && selectedAnnotation) {
            deleteSelectedAnnotation();
        }
        // Escape to deselect
        if (e.key === 'Escape' && selectedAnnotation) {
            deselectAnnotation();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        if (pdfDoc) {
            renderPage(currentPage);
        }
    }, 200));
    window.addEventListener('scroll', positionStyleToolbar);
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

function updateCursor() {
    if (currentTool === 'draw') {
        const tool = drawingTools.find(t => t.name === currentDrawingTool);
        document.body.className = tool.cursor;
    } else if (currentTool === 'highlight') {
        const tool = highlightTools.find(t => t.name === currentHighlightTool);
        document.body.className = tool.cursor;
    } else {
        document.body.className = '';
    }
}

function loadPDF() {
    if (typeof filename === 'undefined' || !filename) {
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No PDF file specified';
        return;
    }
    
    const url = `/uploads/${filename}`;
    console.log('Loading PDF from URL:', url);
    
    loadingIndicator.style.display = 'flex';
    
    pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        totalPages = pdfDoc.numPages;
        console.log('PDF loaded. Total pages:', totalPages);
        currentPage = 1;
        annotations = [];
        undoStack = [];
        redoStack = [];
        updatePageInfo();
        renderPage(currentPage);
        loadingIndicator.style.display = 'none';
    }).catch(function(error) {
        console.error('Failed to load PDF:', error);
        loadingIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed to load PDF: ${error.message}`;
    });
}

function setCurrentTool(tool) {
    console.log('setCurrentTool called with', tool);
    currentTool = tool;
    
    // Update button states
    selectToolBtn.classList.remove('active');
    textToolBtn.classList.remove('active');
    drawToolBtn.classList.remove('active');
    highlightToolBtn.classList.remove('active');
    
    // Show/hide tool options
    document.getElementById('drawing-tools').style.display = 'none';
    document.getElementById('highlight-tools').style.display = 'none';
    drawColorPicker.style.display = 'none';
    drawWidthPicker.style.display = 'none';
    
    switch(tool) {
        case 'select':
            selectToolBtn.classList.add('active');
            toolIndicator.innerHTML = '<i class="fas fa-mouse-pointer"></i> Current Tool: Select';
            document.body.style.cursor = 'default';
            break;
        case 'text':
            textToolBtn.classList.add('active');
            toolIndicator.innerHTML = '<i class="fas fa-font"></i> Current Tool: Text';
            document.body.style.cursor = 'text';
            break;
        case 'draw':
            drawToolBtn.classList.add('active');
            document.getElementById('drawing-tools').style.display = 'flex';
            drawColorPicker.style.display = 'flex';
            drawWidthPicker.style.display = 'flex';
            toolIndicator.innerHTML = '<i class="fas fa-pencil-alt"></i> Current Tool: Draw';
            updateCursor();
            break;
        case 'highlight':
            highlightToolBtn.classList.add('active');
            document.getElementById('highlight-tools').style.display = 'flex';
            drawColorPicker.style.display = 'flex';
            drawWidthPicker.style.display = 'flex';
            
            // Update color picker for highlight colors
            const colorContainer = document.querySelector('#draw-color-picker');
            colorContainer.innerHTML = '<span>Color:</span>';
            
            highlightColorOptions.forEach((option, i) => {
                const colorDiv = document.createElement('div');
                colorDiv.className = `color-option ${i === 0 ? 'selected' : ''}`;
                colorDiv.style.backgroundColor = option.color;
                colorDiv.dataset.color = option.color;
                colorDiv.title = option.name;
                colorDiv.addEventListener('click', function() {
                    document.querySelector('.color-option.selected').classList.remove('selected');
                    this.classList.add('selected');
                    highlightColor = this.dataset.color;
                });
                colorContainer.appendChild(colorDiv);
            });
            
            highlightColor = highlightColorOptions[0].color;
            toolIndicator.innerHTML = '<i class="fas fa-highlighter"></i> Current Tool: Highlight';
            updateCursor();
            break;
    }
    
    // Update cursor for all annotations
    const annotationTexts = document.querySelectorAll('.annotation-text');
    annotationTexts.forEach(el => {
        if (tool === 'select') {
            el.style.cursor = 'move';
            el.contentEditable = true;
        } else {
            el.style.cursor = 'default';
            el.contentEditable = false;
        }
    });
    
    // If switching to text tool, hide style toolbar
    if (tool !== 'select') {
        hideStyleToolbar();
    }
}

function updatePageInfo() {
    const pageInfo = document.getElementById('page-info');
    pageInfo.innerHTML = `<i class="fas fa-file-alt"></i> Page ${currentPage} / ${totalPages}`;
    
    // Enable/disable navigation buttons based on current page
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function goToPreviousPage() {
    if (currentPage <= 1) return;
    saveCurrentAnnotations();
    currentPage--;
    updatePageInfo();
    renderPage(currentPage);
}

function goToNextPage() {
    if (currentPage >= totalPages) return;
    saveCurrentAnnotations();
    currentPage++;
    updatePageInfo();
    renderPage(currentPage);
}

function renderPage(pageNum) {
    loadingIndicator.style.display = 'flex';

    if (!pdfDoc) {
        console.error('PDF document not loaded yet.');
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> PDF document not loaded.';
        return;
    }

    if (pageNum < 1 || pageNum > totalPages) {
        console.error('Invalid page number:', pageNum);
        loadingIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Invalid page number: ${pageNum}`;
        return;
    }
    
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvasWidth = viewport.width;
        canvasHeight = viewport.height;
        const ctx = canvas.getContext('2d');

        // Clear previous content
        pdfContainer.innerHTML = '';
        pdfContainer.appendChild(canvas);

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        renderTask.promise.then(() => {
            setupAnnotationLayer(canvas, viewport);
            loadAnnotationsForPage(pageNum);
            loadingIndicator.style.display = 'none';
        }).catch(err => {
            console.error('Error during page render:', err);
            loadingIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error rendering page: ${err.message}`;
        });
    }).catch(error => {
        console.error('Error getting page:', error);
        loadingIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error getting page: ${error.message}`;
    });
}

function setupAnnotationLayer(pdfCanvas, viewport) {
    // Remove existing annotation layer if any
    const existingLayer = document.querySelector('.annotation-layer');
    if (existingLayer) existingLayer.remove();

    // Create annotation layer div
    const annotationLayer = document.createElement('div');
    annotationLayer.className = 'annotation-layer';
    annotationLayer.style.width = pdfCanvas.width + 'px';
    annotationLayer.style.height = pdfCanvas.height + 'px';
    annotationLayer.style.top = pdfCanvas.offsetTop + 'px';
    annotationLayer.style.left = pdfCanvas.offsetLeft + 'px';
    annotationLayer.style.position = 'absolute';
    annotationLayer.style.pointerEvents = 'auto';

    pdfContainer.appendChild(annotationLayer);

    // Setup drawing canvas
    drawCanvas = document.createElement('canvas');
    drawCanvas.width = pdfCanvas.width;
    drawCanvas.height = pdfCanvas.height;
    drawCanvas.style.position = 'absolute';
    drawCanvas.style.top = '0';
    drawCanvas.style.left = '0';
    drawCanvas.style.zIndex = '10';
    drawCanvas.style.pointerEvents = 'auto';
    drawCanvas.style.willChange = 'contents';
    drawCanvas.style.backgroundColor = 'transparent';
    annotationLayer.appendChild(drawCanvas);
    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    // Setup highlight canvas
    highlightCanvas = document.createElement('canvas');
    highlightCanvas.width = pdfCanvas.width;
    highlightCanvas.height = pdfCanvas.height;
    highlightCanvas.style.position = 'absolute';
    highlightCanvas.style.top = '0';
    highlightCanvas.style.left = '0';
    highlightCanvas.style.zIndex = '5';
    highlightCanvas.style.pointerEvents = 'auto';
    highlightCanvas.style.willChange = 'contents';
    annotationLayer.appendChild(highlightCanvas);
    highlightCtx = highlightCanvas.getContext('2d');
    highlightCtx.lineCap = 'round';
    highlightCtx.lineJoin = 'round';

    // Event listeners for drawing and highlighting
    drawCanvas.addEventListener('mousedown', startDrawingOrHighlighting);
    drawCanvas.addEventListener('mousemove', drawOrHighlight);
    drawCanvas.addEventListener('mouseup', stopDrawingOrHighlighting);
    drawCanvas.addEventListener('mouseout', stopDrawingOrHighlighting);
    
    // Event listener for text tool
    annotationLayer.addEventListener('click', handleAnnotationLayerClick);
}

function handleAnnotationLayerClick(e) {
    if (currentTool === 'text') {
        addTextAnnotation(e.offsetX, e.offsetY);
    } else if (currentTool === 'select') {
        deselectAnnotation();
    }
}

function startDrawingOrHighlighting(e) {
    console.log('startDrawingOrHighlighting called, currentTool:', currentTool);
    if (currentTool === 'draw') {
        console.log('Starting drawing at', e.offsetX, e.offsetY);
        isDrawing = true;
        lastX = e.offsetX;
        lastY = e.offsetY;
        
        // Create a new path for this drawing
        currentPath = {
            type: 'drawing',
            tool: currentDrawingTool,
            color: drawingColor,
            width: drawingLineWidth,
            points: [{x: lastX, y: lastY}],
            page: currentPage,
            completed: false
        };
        annotations.push(currentPath);
        
        drawCtx.strokeStyle = drawingColor;
        drawCtx.lineWidth = drawingLineWidth;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(lastX, lastY);
    } else if (currentTool === 'highlight') {
        console.log('Starting highlighting at', e.offsetX, e.offsetY);
        isHighlighting = true;
        lastX = e.offsetX;
        lastY = e.offsetY;
        
        currentPath = {
            type: 'highlight',
            tool: currentHighlightTool,
            color: highlightColor,
            width: highlightLineWidth,
            points: [{x: lastX, y: lastY}],
            page: currentPage,
            completed: false
        };
        annotations.push(currentPath);
        
        highlightCtx.strokeStyle = highlightColor;
        highlightCtx.lineWidth = highlightLineWidth;
        highlightCtx.lineCap = 'round';
        highlightCtx.lineJoin = 'round';
        highlightCtx.beginPath();
        highlightCtx.moveTo(lastX, lastY);
    } else {
        console.log('startDrawingOrHighlighting called but currentTool is', currentTool);
    }
}

function drawOrHighlight(e) {
    console.log('drawOrHighlight called, isDrawing:', isDrawing, 'isHighlighting:', isHighlighting);
    if (!isDrawing && !isHighlighting) return;
    
    const ctx = currentTool === 'draw' ? drawCtx : highlightCtx;
    const x = e.offsetX;
    const y = e.offsetY;
    
    // Draw a smooth curve
    const midX = (lastX + x) / 2;
    const midY = (lastY + y) / 2;
    
    ctx.quadraticCurveTo(lastX, lastY, midX, midY);
    ctx.stroke();
    
    // Add point to current path
    if (currentPath) {
        currentPath.points.push({x: x, y: y});
    }
    
    lastX = x;
    lastY = y;
}

function stopDrawingOrHighlighting() {
    console.log('stopDrawingOrHighlighting called');
    if (isDrawing || isHighlighting) {
        if (currentPath) {
            currentPath.completed = true;
            currentPath = null;
        }
        saveState();
    }
    isDrawing = false;
    isHighlighting = false;
}

function addTextAnnotation(x, y) {
    const annotationLayer = document.querySelector('.annotation-layer');
    if (!annotationLayer) return;
    
    // Create a text element
    const div = document.createElement('div');
    div.className = 'annotation-text editing';
    div.contentEditable = true;
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.width = '200px';
    div.style.minHeight = '24px';
    div.style.padding = '8px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.overflowWrap = 'break-word';
    div.style.textAlign = 'left';
    div.style.fontFamily = 'Arial';
    div.style.fontSize = '14px';
    div.style.color = '#000000';
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    div.style.writingMode = 'horizontal-tb';
    div.style.textOrientation = 'mixed';
    div.style.display = 'block';
    div.dataset.placeholder = 'Type here...';
    
    const ann = {
        type: 'text',
        x: x,
        y: y,
        width: 200,
        height: 24,
        text: '',
        page: currentPage,
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#000000',
        bold: false,
        italic: false,
        underline: false
    };
    
    annotations.push(ann);
    div.dataset.index = annotations.length - 1;
    
    makeDraggable(div, ann);
    makeResizable(div, ann);
    
    div.addEventListener('input', () => {
        ann.text = div.innerText;
        // Auto-expand height as content grows
        div.style.height = 'auto';
        div.style.height = (div.scrollHeight) + 'px';
        ann.height = div.scrollHeight;
    });
    
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectAnnotation(div, ann);
    });
    
    div.addEventListener('focus', () => {
        // Ensure cursor starts at beginning
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(div, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    });
    
    annotationLayer.appendChild(div);
    
    // Focus and position cursor at start
    div.focus();
    
    // Position style toolbar above the text box
    selectAnnotation(div, ann);
}

function loadAnnotationsForPage(pageNum) {
    const annotationLayer = document.querySelector('.annotation-layer');
    if (!annotationLayer) return;

    // Clear existing annotation elements except canvases
    Array.from(annotationLayer.children).forEach(child => {
        if (!child.classList.contains('annotation-canvas')) child.remove();
    });

    // Clear canvases
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

    // Filter annotations for current page
    const pageAnnotations = annotations.filter(ann => ann.page === pageNum);

    pageAnnotations.forEach((ann, index) => {
        if (ann.type === 'text') {
            const div = document.createElement('div');
            div.className = 'annotation-text';
            div.contentEditable = currentTool === 'select';
            div.style.left = ann.x + 'px';
            div.style.top = ann.y + 'px';
            div.style.width = ann.width + 'px';
            div.style.height = ann.height + 'px';
            div.style.padding = '8px';
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordWrap = 'break-word';
            div.style.overflowWrap = 'break-word';
            div.style.textAlign = 'left';
            div.style.fontFamily = ann.fontFamily;
            div.style.fontSize = ann.fontSize;
            div.style.color = ann.color;
            div.style.fontWeight = ann.bold ? 'bold' : 'normal';
            div.style.fontStyle = ann.italic ? 'italic' : 'normal';
            div.style.textDecoration = ann.underline ? 'underline' : 'none';
            div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            div.style.borderRadius = '4px';
            div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            div.innerText = ann.text;
            div.dataset.index = index;

            // Drag and resize handlers
            makeDraggable(div, ann);
            makeResizable(div, ann);
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                selectAnnotation(div, ann);
            });
            annotationLayer.appendChild(div);
        } else if (ann.type === 'drawing') {
            // Render saved drawings
            drawCtx.strokeStyle = ann.color;
            drawCtx.lineWidth = ann.width;
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.beginPath();
            
            if (ann.points.length > 0) {
                drawCtx.moveTo(ann.points[0].x, ann.points[0].y);
                for (let i = 1; i < ann.points.length; i++) {
                    const midX = (ann.points[i-1].x + ann.points[i].x) / 2;
                    const midY = (ann.points[i-1].y + ann.points[i].y) / 2;
                    drawCtx.quadraticCurveTo(
                        ann.points[i-1].x, ann.points[i-1].y,
                        midX, midY
                    );
                }
                drawCtx.stroke();
            }
        } else if (ann.type === 'highlight') {
            // Render saved highlights
            highlightCtx.strokeStyle = ann.color;
            highlightCtx.lineWidth = ann.width;
            highlightCtx.lineCap = 'round';
            highlightCtx.lineJoin = 'round';
            highlightCtx.beginPath();
            
            if (ann.points.length > 0) {
                highlightCtx.moveTo(ann.points[0].x, ann.points[0].y);
                for (let i = 1; i < ann.points.length; i++) {
                    const midX = (ann.points[i-1].x + ann.points[i].x) / 2;
                    const midY = (ann.points[i-1].y + ann.points[i].y) / 2;
                    highlightCtx.quadraticCurveTo(
                        ann.points[i-1].x, ann.points[i-1].y,
                        midX, midY
                    );
                }
                highlightCtx.stroke();
            }
        }
    });

    // Deselect annotation when clicking outside
    annotationLayer.addEventListener('click', () => {
        if (currentTool === 'select') {
            deselectAnnotation();
        }
    });
}

function saveCurrentAnnotations() {
    const annotationLayer = document.querySelector('.annotation-layer');
    if (!annotationLayer) return;

    // Remove old annotations for current page
    annotations = annotations.filter(ann => ann.page !== currentPage);

    // Save current annotations from DOM
    Array.from(annotationLayer.children).forEach(child => {
        if (child.classList && child.classList.contains('annotation-text')) {
            const computedStyle = window.getComputedStyle(child);
            const ann = {
                type: 'text',
                x: parseInt(child.style.left, 10),
                y: parseInt(child.style.top, 10),
                width: parseInt(child.style.width, 10),
                height: parseInt(child.style.height, 10),
                text: child.innerText,
                page: currentPage,
                fontFamily: computedStyle.fontFamily,
                fontSize: computedStyle.fontSize,
                color: computedStyle.color,
                bold: computedStyle.fontWeight === 'bold' || computedStyle.fontWeight === '700',
                italic: computedStyle.fontStyle === 'italic',
                underline: computedStyle.textDecoration.includes('underline')
            };
            annotations.push(ann);
        }
    });

    // Save drawings and highlights from canvases
    // (These are already saved during drawing in the drawOrHighlight function)

    // Re-index annotations to ensure indices are continuous and correct
    annotations.forEach((ann, index) => {
        ann.index = index;
    });
}

function makeDraggable(element, ann) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
        if (currentTool !== 'select') return;
        if (e.target.classList.contains('resizer')) return;
        
        isDragging = true;
        startX = e.clientX - element.offsetLeft;
        startY = e.clientY - element.offsetTop;
        element.style.border = '2px solid var(--primary-color)';
        element.style.zIndex = '100';
        element.focus();
        e.stopPropagation();
        
        // Select this annotation
        selectAnnotation(element, ann);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.border = 'none';
            element.style.zIndex = 'auto';
            saveState();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let x = e.clientX - startX;
            let y = e.clientY - startY;
            
            // Constrain to canvas bounds
            x = Math.max(0, Math.min(x, canvasWidth - element.offsetWidth));
            y = Math.max(0, Math.min(y, canvasHeight - element.offsetHeight));
            
            element.style.left = x + 'px';
            element.style.top = y + 'px';
            ann.x = x;
            ann.y = y;
            
            // Update style toolbar position
            positionStyleToolbar();
        }
    });
}

function makeResizable(element, ann) {
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    element.appendChild(resizer);

    resizer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartWidth = element.offsetWidth;
        resizeStartHeight = element.offsetHeight;

        function doDrag(e) {
            if (!isResizing) return;
            let newWidth = resizeStartWidth + (e.clientX - resizeStartX);
            let newHeight = resizeStartHeight + (e.clientY - resizeStartY);
            newWidth = Math.max(newWidth, 50);
            newHeight = Math.max(newHeight, 20);
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
            ann.width = newWidth;
            ann.height = newHeight;
            
            // Update style toolbar position
            positionStyleToolbar();
        }

        function stopDrag(e) {
            isResizing = false;
            saveState();
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        }

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    });
}

function selectAnnotation(div, ann) {
    if (currentTool !== 'select') return;
    
    if (selectedAnnotation) {
        deselectAnnotation();
    }
    selectedAnnotation = div;
    div.classList.add('editing');
    showStyleToolbar(div);
    currentEditable = div;
}

function deselectAnnotation() {
    if (selectedAnnotation) {
        selectedAnnotation.classList.remove('editing');
        selectedAnnotation = null;
        hideStyleToolbar();
        currentEditable = null;
    }
}

function deleteSelectedAnnotation() {
    if (!selectedAnnotation) return;
    
    const index = parseInt(selectedAnnotation.dataset.index);
    if (!isNaN(index) && index >= 0 && index < annotations.length) {
        annotations.splice(index, 1);
        selectedAnnotation.remove();
        selectedAnnotation = null;
        hideStyleToolbar();
        saveState();
    }
}

function showStyleToolbar(target) {
    currentEditable = target;
    positionStyleToolbar();
    
    // Set current styles in toolbar controls
    const computedStyle = window.getComputedStyle(target);
    document.getElementById('btn-bold').classList.toggle('active', computedStyle.fontWeight === '700' || computedStyle.fontWeight === 'bold');
    document.getElementById('btn-italic').classList.toggle('active', computedStyle.fontStyle === 'italic');
    document.getElementById('btn-underline').classList.toggle('active', computedStyle.textDecoration.includes('underline'));
    document.getElementById('font-size').value = computedStyle.fontSize;
    document.getElementById('font-family').value = computedStyle.fontFamily.replace(/['"]/g, '').split(',')[0];
    document.getElementById('font-color').value = rgbToHex(computedStyle.color);
    
    styleToolbar.style.display = 'flex';
}

function positionStyleToolbar() {
    if (!currentEditable) return;
    
    const rect = currentEditable.getBoundingClientRect();
    const toolbarHeight = styleToolbar.offsetHeight;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Position above the element with some margin
    let top = rect.top - toolbarHeight - 10;
    let left = rect.left;
    
    // If there's not enough space above, position below
    if (top < 0) {
        top = rect.bottom + 10;
    }
    
    // Ensure toolbar stays within viewport
    top = Math.max(10, Math.min(top, viewportHeight - toolbarHeight - 10));
    left = Math.max(10, Math.min(left, viewportWidth - styleToolbar.offsetWidth - 10));
    
    styleToolbar.style.top = (top + window.scrollY) + 'px';
    styleToolbar.style.left = (left + window.scrollX) + 'px';
}

function hideStyleToolbar() {
    styleToolbar.style.display = 'none';
    currentEditable = null;
}

function rgbToHex(rgb) {
    const result = rgb.match(/\d+/g);
    if (!result) return '#000000';
    return '#' + result.slice(0, 3).map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function applyStyle(command, value = null) {
    if (!currentEditable) return;
    
    const index = parseInt(currentEditable.dataset.index);
    if (isNaN(index) || index < 0 || index >= annotations.length) return;
    
    const ann = annotations[index];
    
    if (command === 'bold') {
        document.execCommand('bold', false, null);
        ann.bold = !ann.bold;
    } else if (command === 'italic') {
        document.execCommand('italic', false, null);
        ann.italic = !ann.italic;
    } else if (command === 'underline') {
        document.execCommand('underline', false, null);
        ann.underline = !ann.underline;
    } else if (command === 'fontSize') {
        document.execCommand('fontSize', false, '7');
        const fontElements = currentEditable.getElementsByTagName('font');
        for (let font of fontElements) {
            if (font.size === '7') {
                font.removeAttribute('size');
                font.style.fontSize = value;
            }
        }
        ann.fontSize = value;
    } else if (command === 'fontName') {
        document.execCommand('fontName', false, value);
        ann.fontFamily = value;
    } else if (command === 'foreColor') {
        document.execCommand('foreColor', false, value);
        ann.color = value;
    }
    
    saveState();
}

function saveState() {
    undoStack.push(JSON.stringify(annotations));
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    
    redoStack.push(JSON.stringify(annotations));
    annotations = JSON.parse(undoStack.pop());
    loadAnnotationsForPage(currentPage);
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    undoStack.push(JSON.stringify(annotations));
    annotations = JSON.parse(redoStack.pop());
    loadAnnotationsForPage(currentPage);
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

function clearCurrentPage() {
    if (!confirm('Are you sure you want to clear all annotations on this page?')) return;
    
    annotations = annotations.filter(ann => ann.page !== currentPage);
    renderPage(currentPage);
    saveState();
}

function saveAnnotations() {
    saveCurrentAnnotations();
    
    // Show saving indicator
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    // Log filename and annotations for debugging
    console.log('Saving annotations with filename:', window.filename);
    console.log('Annotations:', annotations);

    // Defensive check for filename and annotations
    if (!window.filename || !annotations || annotations.length === 0) {
        console.error('Missing filename or annotations before sending save request');
        showToast('Missing filename or annotations. Please upload a PDF and add annotations before saving.', 'error');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        return;
    }
    
    // Send annotations to server
    fetch('/pdf-editor/save', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            annotations: annotations, 
            filename: window.filename,
            timestamp: new Date().toISOString()
        })
    }).then(response => {
        if (response.ok) {
            return response.json();
        }
        return response.text().then(text => {
            throw new Error(`Failed to save annotations: ${text}`);
        });
    }).then(data => {
        showToast('Annotations saved successfully!', 'success');
        // Enable download button with the saved version
        if (data.filename) {
            const downloadFilename = data.filename;
            downloadBtn.href = `/download/${downloadFilename}`;
            downloadBtn.download = downloadFilename;
        }
    }).catch(error => {
        console.error('Error saving annotations:', error);
        showToast('Error saving annotations: ' + error.message, 'error');
    }).finally(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    });
}

function downloadEditedPDF() {
    saveCurrentAnnotations();

    // Show preparing indicator
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
    downloadBtn.style.pointerEvents = 'none';

    // Generate PDF with annotations
    fetch('/pdf-editor/save', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            annotations: annotations, 
            filename: window.filename,
            timestamp: new Date().toISOString()
        })
    }).then(response => {
        if (response.ok) {
            return response.json();
        }
        return response.text().then(text => {
            throw new Error(`Failed to save annotations: ${text}`);
        });
    }).then(data => {
        if (data.filename) {
            const downloadUrl = `/download/${data.filename}`;
            return fetch(downloadUrl);
        } else {
            throw new Error('No filename returned from save');
        }
    }).then(response => {
        if (!response.ok) {
            throw new Error('Failed to download PDF');
        }
        return response.blob();
    }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotated_${window.filename}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('PDF downloaded successfully!', 'success');
    }).catch(error => {
        console.error('Error downloading PDF:', error);
        showToast('Error downloading PDF: ' + error.message, 'error');
    }).finally(() => {
        downloadBtn.innerHTML = originalText;
        downloadBtn.style.pointerEvents = 'auto';
    });
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);