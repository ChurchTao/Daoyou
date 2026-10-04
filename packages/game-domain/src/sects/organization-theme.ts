export interface SectOrganizationTheme {
  facilityNames?: Partial<Record<string, string>>;
  elderTrial?: SectElderTrialPreset;
}

export interface SectElderTrialPreset {
  name: string;
  description: string;
}
