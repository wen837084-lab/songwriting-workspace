export function recordingErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow microphone access in your browser settings, then try again. No take was saved.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Connect a microphone and try again. No take was saved.";
  }
  return error instanceof Error
    ? error.message
    : "Recording failed. No take was saved and your project data is unchanged.";
}
