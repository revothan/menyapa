import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export const ChatInput = ({ inputMessage, setInputMessage, handleSubmit, isLoading }: ChatInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input field when component mounts or after loading state changes
    inputRef.current?.focus();
  }, [isLoading]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        placeholder="Type your message..."
        className="flex-1"
        disabled={isLoading}
      />
      <Button 
        type="submit" 
        size="icon"
        disabled={isLoading || !inputMessage.trim()}
        className={isLoading ? "opacity-50 cursor-not-allowed" : ""}
      >
        <Send className={`h-4 w-4 ${isLoading ? "animate-pulse" : ""}`} />
      </Button>
    </form>
  );
};