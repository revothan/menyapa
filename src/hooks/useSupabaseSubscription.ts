import { useCallback, useRef, useState, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const MAX_RETRY_ATTEMPTS = 5;

export const useSupabaseSubscription = (sessionId: string | null) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<number>();
  const heartbeatIntervalRef = useRef<number>();

  const clearHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  };

  const handleReconnection = useCallback(() => {
    if (!sessionId || retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error('Max retry attempts reached or no session ID');
      toast.error('Unable to maintain connection. Please refresh the page.');
      return;
    }

    const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
    console.log(`Attempting reconnection in ${delay}ms (attempt ${retryCount + 1})`);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setRetryCount(prev => prev + 1);
      if (channelRef.current) {
        console.log('Removing existing channel before reconnection');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setupSubscription(sessionId);
    }, delay);
  }, [sessionId, retryCount]);

  const startHeartbeat = (channel: RealtimeChannel) => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (channel.state === 'closed') {
        clearHeartbeat();
        return;
      }

      channel.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: { timestamp: Date.now() }
      }).catch(error => {
        console.error('Heartbeat failed:', error);
        clearHeartbeat();
        setIsConnected(false);
        handleReconnection();
      });
    }, 30000); // Send heartbeat every 30 seconds
  };

  const setupSubscription = useCallback((sid: string) => {
    if (channelRef.current) {
      console.warn('Subscription already exists, cleaning up first');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      clearHeartbeat();
    }

    console.log('Setting up subscription for session:', sid);
    
    const channel = supabase
      .channel(`chat_messages_${sid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sid}`
        },
        (payload: any) => {
          console.log('Real-time message received:', payload);
          
          if (!['user', 'assistant', 'owner'].includes(payload.new.role)) {
            console.warn(`Invalid role in payload: ${payload.new.role}`);
            return;
          }
        }
      )
      .on('system', { event: 'error' }, (error) => {
        console.error('Subscription error:', error);
        setIsConnected(false);
        toast.error('Connection lost. Attempting to reconnect...', {
          description: 'Please wait while we restore your connection.'
        });
        handleReconnection();
      })
      .subscribe(status => {
        console.log('Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
          setIsConnected(true);
          setRetryCount(0);
          startHeartbeat(channel);
        } else if (status === 'CLOSED') {
          console.log('Subscription closed, attempting to reconnect...');
          setIsConnected(false);
          handleReconnection();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error occurred');
          setIsConnected(false);
          toast.error('Connection error', {
            description: 'There was a problem with the chat connection. Attempting to reconnect...'
          });
          handleReconnection();
        }
      });

    channelRef.current = channel;
    return channel;
  }, [handleReconnection]);

  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    console.log('Manual reconnection requested');
    setRetryCount(0);
    setIsConnected(false);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    clearHeartbeat();
    setupSubscription(sessionId);
    toast.success('Attempting to reconnect...', {
      description: 'Please wait while we restore your connection.'
    });
  }, [sessionId, setupSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up subscription');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearHeartbeat();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return {
    channelRef,
    setupSubscription,
    reconnect,
    isConnected
  };
};