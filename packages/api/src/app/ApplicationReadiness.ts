/** Tracks whether this process has completed all startup work required to serve traffic. */
export class ApplicationReadiness {
  private static ready = false;

  public static isReady(): boolean {
    return ApplicationReadiness.ready;
  }

  public static markReady(): void {
    ApplicationReadiness.ready = true;
  }

  public static markNotReady(): void {
    ApplicationReadiness.ready = false;
  }
}
