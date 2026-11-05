interface SourceBase {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly ownerEmails: readonly string[];
}

export interface IcsSource extends SourceBase {
  readonly kind: "ics";
}

export interface IcloudSource extends SourceBase {
  readonly kind: "icloud";
  readonly appleId: string;
  readonly calendarUrls: readonly string[];
}

export type Source = IcsSource | IcloudSource;
