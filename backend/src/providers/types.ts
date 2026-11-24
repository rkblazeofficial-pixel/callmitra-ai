// Provider-independent calling interface. Another telephony provider can be added
// by implementing CallProvider.
export type CallStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export type PlaceCallInput = {
  toNumber: string; // E.164
  prompt: string;
  voice: string;
  language: string;
  voiceSpeed?: number;
  maxCallSeconds: number;
  silenceIntervalSeconds: number;
  silenceMaxCheckins: number;
  idempotencyKey: string;
  agentId?: number; // saved agent to use (carries the enforced duration limit and voice)
};

export type PlaceCallResult = { providerCallId: string; status: 'initiated' | 'unknown'; replay?: boolean };
export type ProviderCall = { providerCallId: string; status: CallStatus; endReason?: string; answeredBy?: string | null; durationSeconds?: number | null };

export interface CallProvider {
  readonly name: string;
  isOptedOut(toNumber: string): Promise<boolean>;
  addOptOut(toNumber: string): Promise<void>;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  getCall(providerCallId: string): Promise<ProviderCall>;
  cancelQueued(providerCallId: string): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string, readonly retryable = false) {
    super(message);
  }
}
