// `prefix` / `suffix` enable Fill-in-the-Middle (FIM) on models that
// support it (e.g. qwen2.5-coder); plain models just see the prefix.
export interface CompletionRequest {
  model: string;
  prefix: string;
  suffix?: string;
  language?: string;
  num_predict?: number;
}

export interface CompletionResponse {
  completion: string;
  model: string;
}
