import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { PerformanceMonitor } from './performance.monitor';

/**
 * Request Tracking Interceptor
 * 
 * Intercepts all HTTP requests to track:
 * - Active concurrent requests
 * - Request duration
 * - Slow requests (>1s warning)
 */
@Injectable()
export class RequestTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTrackingInterceptor.name);

  constructor(private readonly performanceMonitor: PerformanceMonitor) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    // Track request start
    this.performanceMonitor.onRequestStart();

    return next.handle().pipe(
      tap(() => {
        // Log slow requests
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          this.logger.warn(
            `🐌 Slow request: ${method} ${url} took ${duration}ms`
          );
        }
      }),
      finalize(() => {
        // Track request end
        this.performanceMonitor.onRequestEnd();
      }),
    );
  }
}
