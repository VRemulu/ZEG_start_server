export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];
  
  /**
   * 带日期打印的日志方法
   * @param level 日志等级，可选参数，默认为INFO
   * @param args 要打印的参数列表
   */
  export const log = (levelOrFirstArg: LogLevel | any, ...args: any[]) => {
    // 获取当前时间
    const now = new Date();
    // 转换为北京时间（UTC+8）
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timestamp = beijingTime.toISOString();
    
    // 判断第一个参数是否为日志等级
    let level: LogLevel = LogLevel.INFO;
    let logArgs = args;
    
    if ((Object.values(LogLevel) as readonly string[]).includes(levelOrFirstArg)) {
      level = levelOrFirstArg as LogLevel;
    } else {
      // 如果第一个参数不是日志等级，则将其加入到打印参数中
      logArgs = [levelOrFirstArg, ...args];
    }
    
    // 根据日志等级选择对应的控制台方法
    let logMethod: (...data: any[]) => void = console.log;
    switch (level) {
      case LogLevel.DEBUG:
        logMethod = console.debug;
        break;
      case LogLevel.INFO:
        logMethod = console.log;
        break;
      case LogLevel.WARN:
        logMethod = console.warn;
        break;
      case LogLevel.ERROR:
        logMethod = console.error;
        break;
    }
    
    // 打印带时间戳和日志等级的日志
    logMethod(`[${timestamp}] [${level}]`, ...logArgs);
  };

  export const logInfo = (...args: any[]) => {
    log(LogLevel.INFO, ...args);
  };

  export const logDebug = (...args: any[]) => {
    log(LogLevel.DEBUG, ...args);
  };

  export const logWarn = (...args: any[]) => {
    log(LogLevel.WARN, ...args);
  };

  export const logError = (...args: any[]) => {
    log(LogLevel.ERROR, ...args);
  };
  