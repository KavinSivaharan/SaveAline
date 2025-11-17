import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FirecrawlService } from '@/lib/firecrawl-service';
import { Key, Loader2, CheckCircle2 } from 'lucide-react';

interface ApiKeySetupProps {
  onComplete: () => void;
}

export const ApiKeySetup = ({ onComplete }: ApiKeySetupProps) => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: "Setup Complete",
      description: "Please ask an admin to add the FIRECRAWL_API_KEY to backend secrets",
    });
    
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md border-border shadow-medium">
        <CardHeader className="space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft">
            <Key className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome to Web Scraper</CardTitle>
          <CardDescription className="text-base">
            Enter your Firecrawl API key to get started. Don't have one?{' '}
            <a
              href="https://firecrawl.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get it here
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="fc-xxxxxxxxxxxxxxxx"
                disabled={isValidating}
                className="h-12 text-base font-mono"
              />
            </div>
            
            <Button
              type="submit"
              disabled={isValidating || !apiKey.trim()}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Validate & Continue
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Key className="h-4 w-4" />
              About Firecrawl
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Firecrawl is a powerful web scraping service that handles the complexity of 
              extracting clean, structured content from any website. Your API key is stored 
              securely in your browser.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
