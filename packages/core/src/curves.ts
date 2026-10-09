// Curve geometry shared by drawing, exports and editing: cubic Bézier pieces, the smooth
// curve through given points, the ellipse round a set of atoms, and a hand-drawn path
// made into a few points.
export { cubicPoint, cubicsBounds, cubicsCommands, cubicsPath, nearestOnCubics, sampleCubics } from "./curves/cubic.ts"
export type { Cubic } from "./curves/cubic.ts"
export { catmullRom } from "./curves/spline.ts"
export { simplifyPath } from "./curves/simplify.ts"
export { clearance, ELLIPSE_PAD, ellipseBounds, ellipsePoint, fitEllipse, nearestOnEllipse } from "./curves/ellipse.ts"
export type { Ellipse } from "./curves/ellipse.ts"
