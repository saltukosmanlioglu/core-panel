export interface ApiError {
  error: string;
  code: string;
}

export interface ApiSuccess<T = unknown> {
  status: 'ok';
  data?: T;
}
