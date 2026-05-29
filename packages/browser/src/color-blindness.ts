const MATRICES = {
  protanopia:   [0.567, 0.433, 0,     0.558, 0.442, 0,     0,     0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0,     0.7,   0.3,   0,     0,     0.3,   0.7  ],
  tritanopia:   [0.95,  0.05,  0,     0,     0.433, 0.567, 0,     0.475, 0.525],
}

function applyMatrix(imageData: ImageData, m: number[]): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    data[i]   = Math.round(r*m[0] + g*m[1] + b*m[2])
    data[i+1] = Math.round(r*m[3] + g*m[4] + b*m[5])
    data[i+2] = Math.round(r*m[6] + g*m[7] + b*m[8])
  }
  return new ImageData(data, imageData.width, imageData.height)
}

export function simulateProtanopia(imageData: ImageData): ImageData { return applyMatrix(imageData, MATRICES.protanopia) }
export function simulateDeuteranopia(imageData: ImageData): ImageData { return applyMatrix(imageData, MATRICES.deuteranopia) }
export function simulateTritanopia(imageData: ImageData): ImageData { return applyMatrix(imageData, MATRICES.tritanopia) }
