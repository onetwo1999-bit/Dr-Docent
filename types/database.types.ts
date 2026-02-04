export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Define your tables here
    };
    Views: {
      // Define your views here
    };
    Functions: {
      // Define your functions here
    };
    Enums: {
      // Define your enums here
    };
  };
}
