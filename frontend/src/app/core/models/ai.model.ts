export interface ModelRef {
  name: string;
  size_bytes: number;
  modified_at: string;
  default: boolean;
}

export interface ModelsResponse {
  items: ModelRef[];
  default_model: string;
}

export interface AiFeatures {
  web_search_enabled: boolean;
}
