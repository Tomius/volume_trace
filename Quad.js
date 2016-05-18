function initTextures(gl) {
    texture = gl.createTexture();
    image = new Image();
    image.onload = function() { handleTextureLoaded(image, texture); }
    image.src = "brain-at_4096.jpg";
    return texture
}

function handleTextureLoaded(image, texture) {
    app.gl.bindTexture(app.gl.TEXTURE_2D, texture);
    app.gl.texImage2D(app.gl.TEXTURE_2D, 0, app.gl.RGBA, app.gl.RGBA, app.gl.UNSIGNED_BYTE, image);
    app.gl.bindTexture(app.gl.TEXTURE_2D, null);
    window.requestAnimationFrame(function (){ app.update();}); // remove this from start()
}

var Quad = function(gl)
{
    this.volume = initTextures(gl);
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array( [
               -1.0, -1.0,
               -1.0, +1.0,
               +1.0, -1.0,
               +1.0, +1.0 ] ),
                gl.STATIC_DRAW);

    this.vertexBuffer.itemSize = 2;
    this.vertexBuffer.numItems = 4;
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.vertexShader, vsQuadSrc);
    gl.compileShader(this.vertexShader);
    output.textContent += gl.getShaderInfoLog(this.vertexShader);

    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(this.fragmentShader, fsTraceSrc);
    gl.compileShader(this.fragmentShader);
    output.textContent +=
            gl.getShaderInfoLog(this.fragmentShader);

    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    gl.linkProgram(this.program);
    output.textContent += gl.getProgramInfoLog(this.program);

    this.positionAttributeIndex =
        gl.getAttribLocation(this.program, 'vPosition');

    this.viewDirMatrixLocation =
        gl.getUniformLocation(this.program, 'viewDirMatrix');
    this.timeLocation =
        gl.getUniformLocation(this.program, 'time');
    this.eyeLocation = gl.getUniformLocation(this.program, 'eye');
    this.opacityTraceLocation = gl.getUniformLocation(this.program, 'opacityTrace');
    this.spacePressed = false;

    this.quadricsLocation = gl.getUniformLocation(this.program, 'quadrics');
    this.materialsLocation = gl.getUniformLocation(this.program, 'materials');

    this.volumeLocation = gl.getUniformLocation(this.program,'volume');

    this.quadricData = new Float32Array(16*32);
    this.materialData = new Float32Array(16*4);

    var A = this.makeSphere();
    A.copyIntoArray(this.quadricData, 0*16);

    var B = this.makeSphere();
    scaler = new Matrix4();
    scaler.setIdentity();
    scaler.setDiagonal(new Vector4(0.5, 2.0, 0.9, 1));
    B.multiply(scaler);
    scaler.transpose();
    B = scaler.mult(B);
    B.copyIntoArray(this.quadricData, 1*16);

    var A = this.makeSphere();
    scaler = new Matrix4();
    scaler.setIdentity();
    scaler.setDiagonal(new Vector4(2, 2, 2, 1));
    A.multiply(scaler);
    scaler.transpose();
    A = scaler.mult(A);
    A.copyIntoArray(this.quadricData, 2*16);

    var B = this.makeSphere();
    B.copyIntoArray(this.quadricData, 3*16);

    this.materialData[0] = 1.0;
    this.materialData[1] = 1.0;
    this.materialData[2] = 0.5;
    this.materialData[3] = 0.5;

    this.materialData[4] = 0.75;
    this.materialData[5] = 1.0;
    this.materialData[6] = 1.0;
    this.materialData[7] = 0.75;
} // Quad constructor ends

Quad.prototype.makeSphere = function(){
    return new Matrix4( 1.0, 0.0, 0.0, 0.0,
                        0.0, 1.0, 0.0, 0.0,
                        0.0, 0.0, 1.0, 0.0,
                        0.0, 0.0, 0.0,-1.0);
}

Quad.prototype.keydown = function(keyCode) {
    if(keyboardMap[keyCode] == 'SPACE') this.spacePressed = !this.spacePressed;
}

Quad.prototype.draw = function(gl, camera)  {
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray( this.positionAttributeIndex);
    gl.vertexAttribPointer( this.positionAttributeIndex,
          2, gl.FLOAT,
          false, 0,
          0);

    viewDirMatrixData = new Float32Array(16);
    camera.viewDirMatrix.copyIntoArray(viewDirMatrixData, 0);
    gl.uniformMatrix4fv(this.viewDirMatrixLocation, false, viewDirMatrixData);

    gl.uniform3f(this.eyeLocation, camera.position.x, camera.position.y, camera.position.z);
    gl.uniformMatrix4fv(this.quadricsLocation, false, this.quadricData);
    gl.uniform4fv(this.materialsLocation, this.materialData);
    var time = new Date().getTime() / 1000.0;
    var timeArray = new Float32Array(4);
    timeArray[0] = Math.abs(1.5 * (time % 1.5) / 1.5 - 0.75);
    timeArray[1] = Math.abs(1.5 * (time % 4.0) / 4.0 - 0.75);
    timeArray[2] = Math.abs(1.5 * (time % 10.0) / 10.0 - 0.75);
    timeArray[3] = Math.abs(1.5 * (time % 35.0) / 35.0 - 0.75);
    gl.uniform4fv(this.timeLocation, timeArray);

    //rajzoláskor
    gl.uniform1i(this.volumeLocation, 0);
    gl.uniform1i(this.opacityTraceLocation, this.spacePressed);
    gl.bindTexture(gl.TEXTURE_2D, this.volume);
    gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_MIN_FILTER,
                         gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_MAG_FILTER,
                         gl.LINEAR);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

