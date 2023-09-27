export declare abstract class Try<A> {
    abstract isReturn(): boolean;
    abstract isThrow(): boolean;
    abstract apply(): A;
    abstract map<B>(f: (value: A) => B): Try<B>;
    abstract flatMap<B>(f: (value: A) => Try<B>): Try<B>;
    abstract filter(f: (value: A) => boolean): Try<A>;
    abstract flatten<B>(this: Try<Try<B>>): Try<B>;
    static apply<A>(f: () => A): Try<A>;
}
export declare class Return<A> extends Try<A> {
    value: A;
    constructor(value: A);
    isReturn(): boolean;
    isThrow(): boolean;
    apply(): A;
    map<B>(f: (value: A) => B): Try<B>;
    flatMap<B>(f: (value: A) => Try<B>): Try<B>;
    filter(f: (value: A) => boolean): Try<A>;
    flatten<B>(this: Try<Try<B>>): Try<B>;
}
export declare class Throw<A> extends Try<A> {
    error: Error;
    constructor(error: Error);
    isReturn(): boolean;
    isThrow(): boolean;
    apply(): A;
    map<B>(f: (value: A) => B): Try<B>;
    flatMap<B>(f: (value: A) => Try<B>): Try<B>;
    filter(f: (value: A) => boolean): Try<A>;
    flatten<B>(this: Try<Try<B>>): Try<B>;
}
export declare class Future<A> {
    promise: Promise<A>;
    private resolve;
    private reject;
    private status;
    constructor();
    static value<A>(value: A): Future<A>;
    static error<A>(error: Error): Future<A>;
    setValue(value: A): void;
    setError(error: Error): void;
    flatMap<B>(f: (value: A) => Future<B>): Future<B>;
    map<B>(f: (value: A) => B): Future<B>;
    filter(f: (value: A) => boolean): Future<A>;
    flatten<B>(this: Future<Future<B>>): Future<B>;
    isReady(): boolean;
    handle(rescueError: (e: Error) => A): Future<A>;
    rescue(rescueError: (e: Error) => Future<A>): Future<A>;
    liftToTry(): Future<Try<A>>;
    lowerFromTry(): Future<A>;
}
