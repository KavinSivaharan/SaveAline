import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Try to find RSS/sitemap feeds (universal standard)
async function discoverFeed(baseUrl: string): Promise<string[]> {
  const commonFeeds = [
    '/feed',
    '/feed.xml',
    '/rss',
    '/rss.xml',
    '/atom.xml',
    '/sitemap.xml',
    '/blog/feed',
    '/blog/rss',
  ];

  for (const path of commonFeeds) {
    try {
      const feedUrl = new URL(path, baseUrl).href;
      const response = await fetch(feedUrl);
      
      if (response.ok) {
        const text = await response.text();
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<urlset')) {
          console.log(`Found feed at: ${feedUrl}`);
          return extractUrlsFromFeed(text, baseUrl);
        }
      }
    } catch {
      continue;
    }
  }
  
  return [];
}

// Extract URLs from RSS/Sitemap XML
function extractUrlsFromFeed(xml: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  // Match <loc>URL</loc> (sitemap) or <link>URL</link> (RSS)
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  const linkRegex = /<link>([^<]+)<\/link>/g;
  
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    try {
      const url = new URL(match[1].trim());
      if (url.hostname === baseUrlObj.hostname) {
        urls.add(url.href);
      }
    } catch {}
  }
  
  while ((match = linkRegex.exec(xml)) !== null) {
    try {
      const url = new URL(match[1].trim());
      if (url.hostname === baseUrlObj.hostname) {
        urls.add(url.href);
      }
    } catch {}
  }
  
  return Array.from(urls);
}

// Helper to extract links from markdown content
function extractLinks(markdown: string, baseUrl: string): string[] {
  const links = new Set<string>();
  
  // Match markdown links [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = markdownLinkRegex.exec(markdown)) !== null) {
    const url = match[2];
    try {
      const linkUrl = new URL(url, baseUrl);
      const baseUrlObj = new URL(baseUrl);
      
      if (linkUrl.hostname === baseUrlObj.hostname && !url.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js)$/i)) {
        links.add(linkUrl.href);
      }
    } catch {}
  }
  
  // Also extract plain URLs that look like blog posts
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  let urlMatch;
  
  while ((urlMatch = urlRegex.exec(markdown)) !== null) {
    const url = urlMatch[0];
    try {
      const linkUrl = new URL(url);
      const baseUrlObj = new URL(baseUrl);
      
      if (linkUrl.hostname === baseUrlObj.hostname && 
          !url.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js)$/i) &&
          linkUrl.pathname !== baseUrlObj.pathname) {
        links.add(linkUrl.href);
      }
    } catch {}
  }
  
  // Filter out common navigation/footer links BUT keep all content
  return Array.from(links).filter(link => {
    const lower = link.toLowerCase();
    const navPatterns = [
      '/signup', '/login', '/logout', '/signin', '/register',
      '/about', '/contact', '/privacy', '/terms', '/faq',
      '/pricing', '/features', '/careers', '/jobs',
      '/support', '/help', '/demo', '/account', '/settings'
    ];
    
    // Skip navigation links
    if (navPatterns.some(pattern => lower.includes(pattern))) {
      return false;
    }
    
    // Keep everything else - don't be too restrictive!
    return true;
  });
}

// Detect content type from URL and content
function detectContentType(url: string, title: string, content: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  if (lowerUrl.includes('/blog') || lowerUrl.includes('/post')) return 'blog';
  if (lowerUrl.includes('/podcast') || lowerContent.includes('transcript')) return 'podcast_transcript';
  if (lowerUrl.includes('/linkedin.com')) return 'linkedin_post';
  if (lowerUrl.includes('/reddit.com')) return 'reddit_comment';
  if (lowerTitle.includes('book') || lowerContent.includes('chapter')) return 'book';
  
  return 'blog'; // Default to blog for most content
}

// Sleep helper for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Try common blog/content paths to discover more URLs
async function discoverCommonPaths(baseUrl: string): Promise<string[]> {
  const discovered = new Set<string>();
  const paths = ['/blog', '/articles', '/posts', '/learn', '/guides', '/resources', '/news'];
  
  for (const path of paths) {
    try {
      const testUrl = new URL(path, baseUrl).href;
      const response = await fetch(`https://r.jina.ai/${testUrl}`, {
        headers: { 'X-Return-Format': 'markdown' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.content || data.content || '';
        const links = extractLinks(markdown, baseUrl);
        links.forEach(link => discovered.add(link));
      }
      await sleep(200);
    } catch {}
  }
  
  return Array.from(discovered);
}

// Retry with exponential backoff - optimized for Jina AI
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return immediately
      if (response.ok) {
        return response;
      }
      
      // If rate limited, wait with exponential backoff
      if (response.status === 429) {
        const waitTime = Math.min(2000 * Math.pow(2, attempt), 30000); // 2s, 4s, 8s, 16s, 30s
        console.log(`Rate limited, waiting ${waitTime}ms (${attempt + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      
      // Other errors - return for caller to handle
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const waitTime = Math.min(1000 * (attempt + 1), 5000); // 1s, 2s, 3s, 4s, 5s
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    console.log('Starting background scrape job for URL:', url);
    
    // Create job in database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: job, error: jobError } = await supabaseClient
      .from('scrape_jobs')
      .insert({
        url,
        status: 'processing',
        progress: 0,
        total: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create scrape job');
    }

    console.log('Created job:', job.id);

    // Start background scraping
    const backgroundScrape = async () => {
      try {
        await performScrape(url, job.id, supabaseClient);
      } catch (error) {
        console.error('Background scrape error:', error);
        await supabaseClient
          .from('scrape_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', job.id);
      }
    };

    // Use EdgeRuntime.waitUntil to keep function alive while scraping
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundScrape());
    } else {
      // Fallback for local development
      backgroundScrape().catch(console.error);
    }

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        message: 'Scraping started in background',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error starting scrape job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Background scraping function
async function performScrape(url: string, jobId: string, supabaseClient: any) {
  const items: any[] = [];
  const startTime = Date.now();
  const MAX_RUNTIME = 300000; // 5 minutes - extended for background tasks
  let shouldStop = false;
  
  // Helper to check if we should stop
  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_RUNTIME) {
      shouldStop = true;
      return true;
    }
    return false;
  };
  
  // Auto-save progress every 15 seconds
  const autoSaveInterval = setInterval(async () => {
    if (items.length > 0) {
      await supabaseClient
        .from('scrape_jobs')
        .update({
          result: {
            site: url,
            items,
            scraped: items.length,
          },
        })
        .eq('id', jobId);
      console.log(`Auto-saved ${items.length} items`);
    }
  }, 15000);
  
  // Helper to save final status
  const saveFinalStatus = async (finalItems: any[], totalLinks: number) => {
    const status = finalItems.length >= totalLinks * 0.8 ? 'completed' : 'partial';
    const updateResult = await supabaseClient
      .from('scrape_jobs')
      .update({
        status,
        progress: totalLinks,
        result: {
          site: url,
          items: finalItems,
          scraped: finalItems.length,
          total: totalLinks,
        },
      })
      .eq('id', jobId);
    
    if (updateResult.error) {
      console.error('❌ Error saving final status:', updateResult.error);
    } else {
      console.log(`✅ Final status saved: ${status} - ${finalItems.length}/${totalLinks} pages`);
    }
  };
  
  try {

    // Step 1: Try RSS/Sitemap first
    console.log('Attempting RSS/Sitemap discovery...');
    let discoveredLinks = await discoverFeed(url);
    
    if (discoveredLinks.length > 0) {
      console.log(`Found ${discoveredLinks.length} URLs via RSS/Sitemap`);
    } else {
      // Step 2: Try common blog paths
      console.log('No feed found, trying common paths...');
      const commonPathLinks = await discoverCommonPaths(url);
      discoveredLinks.push(...commonPathLinks);
      console.log(`Found ${commonPathLinks.length} URLs from common paths`);
      
      // Step 3: Scrape main page and extract links
      console.log('Extracting links from main page...');
      const jinaUrl = `https://r.jina.ai/${url}`;
      const mainPageResponse = await fetch(jinaUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Return-Format': 'markdown',
        },
      });

      if (!mainPageResponse.ok) {
        throw new Error(`Failed to fetch main page: ${mainPageResponse.status}`);
      }

      let mainPageData;
      try {
        mainPageData = await mainPageResponse.json();
      } catch (e) {
        console.error('Failed to parse main page JSON, skipping');
        throw new Error('Main page did not return valid JSON');
      }
      
      const mainPageMarkdown = mainPageData.data?.content || mainPageData.content || '';
      const mainPageLinks = extractLinks(mainPageMarkdown, url);
      discoveredLinks.push(...mainPageLinks);
      console.log(`Found ${mainPageLinks.length} links from main page`);
      
      // Remove duplicates
      discoveredLinks = Array.from(new Set(discoveredLinks));
      console.log(`Total unique URLs discovered: ${discoveredLinks.length}`);
      
      // If still no links, scrape main page only
      if (discoveredLinks.length === 0) {
        const mainPageTitle = mainPageData.data?.title || mainPageData.title || 'Main Page';
        items.push({
          title: mainPageTitle,
          content: mainPageMarkdown,
          content_type: detectContentType(url, mainPageTitle, mainPageMarkdown),
          source_url: url,
        });
        
        await supabaseClient
          .from('scrape_jobs')
          .update({
            status: 'completed',
            progress: 1,
            total: 1,
            result: { site: url, items },
          })
          .eq('id', jobId);
        
        return;
      }
    }

    // Update job with total count (NO 50 URL LIMIT - scrape ALL)
    const linksToScrape = discoveredLinks; // Remove artificial limit
    await supabaseClient
      .from('scrape_jobs')
      .update({
        total: linksToScrape.length,
      })
      .eq('id', jobId);

    console.log(`Scraping ${linksToScrape.length} URLs with aggressive rate limiting...`);
    
    // Fast approach - complete before timeout
    const INITIAL_CONCURRENCY = 12; // Start with 12 concurrent (aggressive)
    const MAX_CONCURRENCY = 20; // Max 20 concurrent (push limits)
    const MIN_CONCURRENCY = 8; // Higher minimum for speed
    let currentConcurrency = INITIAL_CONCURRENCY;
    let consecutiveSuccesses = 0;
    let consecutiveRateLimits = 0;
    
    const scrapePage = async (link: string, index: number) => {
      // Check timeout before starting
      if (checkTimeout()) {
        return null;
      }
      
      try {
        const linkJinaUrl = `https://r.jina.ai/${link}`;
        
        const linkResponse = await fetchWithRetry(
          linkJinaUrl,
          {
            headers: {
              'Accept': 'application/json',
              'X-Return-Format': 'markdown',
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout per request
          },
          2 // 2 retries max
        );

        if (linkResponse.ok) {
          consecutiveSuccesses++;
          consecutiveRateLimits = 0;
          
          // Increase concurrency quickly
          if (consecutiveSuccesses >= 10 && currentConcurrency < MAX_CONCURRENCY) {
            currentConcurrency++;
            console.log(`📈 Increased concurrency to ${currentConcurrency}`);
            consecutiveSuccesses = 0;
          }
          
          let linkData;
          try {
            linkData = await linkResponse.json();
          } catch (e) {
            console.error(`Invalid JSON from ${link}`);
            return null;
          }
          
          const content = linkData.data?.content || linkData.content || '';
          const title = linkData.data?.title || linkData.title || link;
          
          if (content.trim() && content.length > 200) {
            console.log(`✓ [${index + 1}/${linksToScrape.length}] ${title.substring(0, 50)}`);
            return {
              title,
              content,
              content_type: detectContentType(link, title, content),
              source_url: link,
            };
          }
        } else if (linkResponse.status === 429) {
          consecutiveRateLimits++;
          consecutiveSuccesses = 0;
          
          // Slow down if hitting rate limits
          if (consecutiveRateLimits >= 3 && currentConcurrency > MIN_CONCURRENCY) {
            currentConcurrency = Math.max(MIN_CONCURRENCY, currentConcurrency - 1);
            console.log(`📉 Reduced concurrency to ${currentConcurrency} due to rate limits`);
            consecutiveRateLimits = 0;
          }
        }
      } catch (error) {
        console.error(`Failed: ${link} - ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    };
    
    // Process in adaptive batches
    let processedCount = 0;
    for (let i = 0; i < linksToScrape.length; i += currentConcurrency) {
      // Check timeout before each batch
      if (checkTimeout()) {
        console.log(`⏱️ Timeout reached. Saving ${items.length}/${linksToScrape.length} pages...`);
        await saveFinalStatus(items, linksToScrape.length);
        clearInterval(autoSaveInterval);
        return; // Exit immediately after saving
      }
      
      const batch = linksToScrape.slice(i, i + currentConcurrency);
      const batchPromises = batch.map((link, idx) => scrapePage(link, i + idx));
      
      const results = await Promise.all(batchPromises);
      
      // Add successful results
      for (const result of results) {
        if (result) {
          items.push(result);
        }
      }
      
      processedCount += batch.length;
      
      // Update progress
      await supabaseClient
        .from('scrape_jobs')
        .update({
          progress: processedCount,
        })
        .eq('id', jobId);
      
      // Short delay between batches
      if (i + currentConcurrency < linksToScrape.length) {
        await sleep(500); // 0.5 second between batches
      }
    }

    console.log(`Scraped ${items.length}/${linksToScrape.length} pages`);
    clearInterval(autoSaveInterval);

    // Save final results
    await saveFinalStatus(items, linksToScrape.length);
      
  } catch (error) {
    console.error('Error in background scrape:', error);
    clearInterval(autoSaveInterval);
    
    // Save whatever we got before erroring
    if (items.length > 0) {
      await supabaseClient
        .from('scrape_jobs')
        .update({
          status: 'partial',
          result: {
            site: url,
            items,
            scraped: items.length,
          },
        })
        .eq('id', jobId);
    }
    throw error;
  } finally {
    clearInterval(autoSaveInterval);
  }
}
