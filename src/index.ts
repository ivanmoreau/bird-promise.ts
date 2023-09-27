
// Helper Classes
type Status = "pending" | "resolved" | "rejected" | "initializing"


/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export abstract class Try<A> {
    abstract isReturn(): boolean
    abstract isThrow(): boolean
    abstract apply(): A
    abstract map<B>(f: (value: A) => B): Try<B>
    abstract flatMap<B>(f: (value: A) => Try<B>): Try<B>
    abstract filter(f: (value: A) => boolean): Try<A>
    abstract flatten<B>(this: Try<Try<B>>): Try<B>

    static apply<A>(f: () => A): Try<A> {
        try {
            return new Return(f())
        } catch (e: any) {
            if (e instanceof Error) {
                return new Throw(e)
            } else {
                return new Throw(new Error(e))
            }
        }
    }
}

/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export class Return<A> extends Try<A> {
    constructor(public value: A) {
        super()
    }

    isReturn(): boolean {
        return true
    }
    isThrow(): boolean {
        return false
    }
    apply(): A {
        return this.value
    }
    map<B>(f: (value: A) => B): Try<B> {
        return new Return(f(this.value))
    }
    flatMap<B>(f: (value: A) => Try<B>): Try<B> {
        return f(this.value)
    }
    filter(f: (value: A) => boolean): Try<A> {
        if (f(this.value)) {
            return this
        } else {
            return new Throw(new Error("Return filtered out."))
        }
    }
    flatten<B>(this: Try<Try<B>>): Try<B> {
        return this.flatMap((value) => value)
    }
}

/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export class Throw<A> extends Try<A> {
    constructor(public error: Error) {
        super()
    }

    isReturn(): boolean {
        return false
    }
    isThrow(): boolean {
        return true
    }
    apply(): A {
        throw this.error
    }
    map<B>(f: (value: A) => B): Try<B> {
        return new Throw(this.error)
    }
    flatMap<B>(f: (value: A) => Try<B>): Try<B> {
        return new Throw(this.error)
    }
    filter(f: (value: A) => boolean): Try<A> {
        return this
    }
    flatten<B>(this: Try<Try<B>>): Try<B> {
        return this.flatMap((value) => value)
    }
}

/// A Future is a value that will be set in the future.
/// Inspired by the Twitter Promise implementation:
/// https://twitter.github.io/util/docs/com/twitter/util/Promise.html
/// We expose a promise that will be resolved or rejected, thus
/// allowing the user to use the Future with async/await.
export class Future<A> {
    promise: Promise<A>
    // Typescript is freaking out because it thinks that resolve and reject
    // are not being defined in the constructor. This is actually good
    // behavior. As the promise contructor requires a lambda, we can't
    // be sure that resolve and reject will be defined before the Future
    // constructor is called. We assume that this process will be quick
    // enough to not cause any problems, but it does makes this
    // implementation a bit unsafe.
    private resolve: (value: A) => void = () => {}
    private reject: (error: Error) => void = () => {}
    private status: Status = "initializing"

    constructor() {
        let that = this // I'm not entirely sure if this is necessary, but
        // my intuition tells me that `this` in the Promise's lambda
        // is going to be a `this` to that context, not to the Future one.
        // Dunno, I don't usually use Javascript, but we'll take the
        // safe route here.

        this.promise = new Promise((resolve, reject) => {
            that.resolve = resolve
            that.reject = reject
            that.status = "pending"
        })
    }

    static value<A>(value: A): Future<A> {
        let future: Future<A> = new Future<A>()
        future.setValue(value)
        return future
    }

    static error<A>(error: Error): Future<A> {
        let future: Future<A> = new Future<A>()
        future.setError(error)
        return future
    }

    setValue(value: A) {
        if (this.status != "pending") {
            throw new Error("Can't set value of a non-pending future.")
        } else {
            this.resolve(value)
            this.status = "resolved"
        }
    }

    setError(error: Error) {
        if (this.status != "pending") {
            throw new Error("Can't set error of a non-pending future.")
        } else {
            this.reject(error)
            this.status = "rejected"
        }
    }

    flatMap<B>(f: (value: A) => Future<B>): Future<B> {
        let future: Future<B> = new Future<B>()
        this.promise.then((value) => {
            let newFuture: Future<B> = f(value)
            newFuture.promise.then((value) => {
                future.setValue(value)
            }).catch((error) => {
                future.setError(error)
            })
        }).catch((error) => {
            future.setError(error)
        })
        return future
    }

    map<B>(f: (value: A) => B): Future<B> {
        return this.flatMap((value) => Future.value(f(value)))
    }

    filter(f: (value: A) => boolean): Future<A> {
        return this.flatMap((value) => {
            if (f(value)) {
                return Future.value(value)
            } else {
                return Future.error(new Error("Future filtered out."))
            }
        })
    }

    flatten<B>(this: Future<Future<B>>): Future<B> {
        return this.flatMap((value) => value)
    }

    isReady(): boolean {
        return this.status != "pending" && this.status != "initializing"
    }

    handle(rescueError: (e: Error) => A): Future<A> {
        let future: Future<A> = new Future<A>()
        this.promise.then((value) => {
            future.setValue(value)
        }).catch((error) => {
            future.setValue(rescueError(error))
        })
        return future
    }

    rescue(rescueError: (e: Error) => Future<A>): Future<A> {
        let future: Future<A> = new Future<A>()
        this.promise.then((value) => {
            future.setValue(value)
        }).catch((error) => {
            let newFuture: Future<A> = rescueError(error)
            newFuture.promise.then((value) => {
                future.setValue(value)
            }).catch((error) => {
                future.setError(error)
            })
        })
        return future
    }

    liftToTry(): Future<Try<A>> {
        return this.map<Try<A>>((value) => new Return(value)).handle((error) => new Throw(error))
    }

    lowerFromTry(): Future<A> {
        return this.flatMap((value) => {
            if (value instanceof Try) {
                if (value.isReturn()) {
                    return Future.value(value.apply())
                } else {
                    return Future.error(value.apply())
                }
            } else {
                throw new Error("Can't lower a non-Try value.")
            }
        })
    }

}