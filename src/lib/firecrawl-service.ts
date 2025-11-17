import { supabase } from '@/integrations/supabase/client';

export class FirecrawlService {
  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Testing API key with Firecrawl API');
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: 'https://example.com',
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  }

  static async crawlWebsite(
    url: string, 
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      console.log('Starting scrape with Jina AI');
      
      // Start the scrape job
      const { data: startData, error: startError } = await supabase.functions.invoke('scrape-website', {
        body: { url }
      });

      if (startError) {
        console.error('Failed to start scrape:', startError);
        return { 
          success: false, 
          error: startError.message || 'Failed to start scrape'
        };
      }

      const jobId = startData?.jobId;
      if (!jobId) {
        return {
          success: false,
          error: 'No job ID returned'
        };
      }

      console.log('Scrape job started:', jobId, '- polling for status...');

      // Poll for status
      const maxAttempts = 600; // 10 minutes max (600 * 1 second)
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const { data: statusData, error: statusError } = await supabase.functions.invoke('crawl-status', {
          body: { jobId }
        });

        if (statusError) {
          console.error('Status check error:', statusError);
          continue; // Keep trying
        }

        const status = statusData?.data?.status;
        const progress = statusData?.data?.progress || 0;
        const total = statusData?.data?.total || 0;
        
        console.log(`Progress: ${progress}/${total} - Status: ${status}`);
        
        // Call progress callback
        if (onProgress && total > 0) {
          onProgress(progress, total);
        }

        if (status === 'completed' || status === 'partial') {
          const result = statusData?.data?.result;
          if (!result) {
            return {
              success: false,
              error: 'No result data in completed job'
            };
          }
          const message = status === 'partial' 
            ? `Scrape partially completed: ${result.scraped || 0}/${result.total || 0} pages`
            : 'Scrape completed successfully';
          console.log(message);
          return {
            success: true,
            data: result
          };
        }

        if (status === 'failed') {
          return {
            success: false,
            error: statusData?.data?.error || 'Scrape failed'
          };
        }

        attempts++;
      }

      // Timeout
      return {
        success: false,
        error: 'Scrape timeout - job is still processing'
      };

    } catch (error) {
      console.error('Unexpected error during scrape:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static detectContentType(title: string, url: string, content: string): string {
    const titleLower = title.toLowerCase();
    const urlLower = url.toLowerCase();
    const contentLower = content.toLowerCase();

    // LinkedIn detection
    if (urlLower.includes('linkedin.com') || titleLower.includes('linkedin')) {
      return 'linkedin_post';
    }

    // Reddit detection
    if (urlLower.includes('reddit.com') || titleLower.includes('reddit')) {
      return 'reddit_comment';
    }

    // Podcast detection
    if (urlLower.includes('/podcast') || 
        titleLower.includes('podcast') || 
        urlLower.includes('/episode') ||
        contentLower.includes('transcript') ||
        contentLower.includes('listen to')) {
      return 'podcast_transcript';
    }

    // Book detection
    if (urlLower.includes('/book') || 
        titleLower.includes('chapter') ||
        titleLower.includes('book') ||
        urlLower.includes('/chapter')) {
      return 'book';
    }

    // Blog detection (broader patterns)
    if (urlLower.includes('/blog') || 
        urlLower.includes('/post') ||
        urlLower.includes('/article') ||
        urlLower.includes('/guide') ||
        urlLower.includes('/learn') ||
        urlLower.includes('/topics') ||
        urlLower.includes('/interview') ||
        urlLower.includes('/insights') ||
        urlLower.includes('/news') ||
        urlLower.match(/\/\d{4}\/\d{2}\//) || // Date pattern in URL
        titleLower.includes('guide')) {
      return 'blog';
    }

    // Call transcript detection
    if (contentLower.includes('speaker:') || 
        contentLower.includes('transcript:') ||
        titleLower.includes('call transcript')) {
      return 'call_transcript';
    }
    
    return 'other';
  }
}
