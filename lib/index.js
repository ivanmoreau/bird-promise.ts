/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export class Try {
    static apply(f) {
        try {
            return new Return(f());
        }
        catch (e) {
            if (e instanceof Error) {
                return new Throw(e);
            }
            else {
                return new Throw(new Error(e));
            }
        }
    }
}
/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export class Return extends Try {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    isReturn() {
        return true;
    }
    isThrow() {
        return false;
    }
    apply() {
        return this.value;
    }
    map(f) {
        return new Return(f(this.value));
    }
    flatMap(f) {
        return f(this.value);
    }
    filter(f) {
        if (f(this.value)) {
            return this;
        }
        else {
            return new Throw(new Error("Return filtered out."));
        }
    }
    flatten() {
        return this.flatMap((value) => value);
    }
}
/// https://twitter.github.io/util/docs/com/twitter/util/Try.html
export class Throw extends Try {
    error;
    constructor(error) {
        super();
        this.error = error;
    }
    isReturn() {
        return false;
    }
    isThrow() {
        return true;
    }
    apply() {
        throw this.error;
    }
    map(f) {
        return new Throw(this.error);
    }
    flatMap(f) {
        return new Throw(this.error);
    }
    filter(f) {
        return this;
    }
    flatten() {
        return this.flatMap((value) => value);
    }
}
/// A Future is a value that will be set in the future.
/// Inspired by the Twitter Promise implementation:
/// https://twitter.github.io/util/docs/com/twitter/util/Promise.html
/// We expose a promise that will be resolved or rejected, thus
/// allowing the user to use the Future with async/await.
export class Future {
    promise;
    // Typescript is freaking out because it thinks that resolve and reject
    // are not being defined in the constructor. This is actually good
    // behavior. As the promise contructor requires a lambda, we can't
    // be sure that resolve and reject will be defined before the Future
    // constructor is called. We assume that this process will be quick
    // enough to not cause any problems, but it does makes this
    // implementation a bit unsafe.
    resolve = () => { };
    reject = () => { };
    status = "initializing";
    constructor() {
        let that = this; // I'm not entirely sure if this is necessary, but
        // my intuition tells me that `this` in the Promise's lambda
        // is going to be a `this` to that context, not to the Future one.
        // Dunno, I don't usually use Javascript, but we'll take the
        // safe route here.
        this.promise = new Promise((resolve, reject) => {
            that.resolve = resolve;
            that.reject = reject;
            that.status = "pending";
        });
    }
    static value(value) {
        let future = new Future();
        future.setValue(value);
        return future;
    }
    static error(error) {
        let future = new Future();
        future.setError(error);
        return future;
    }
    setValue(value) {
        if (this.status != "pending") {
            throw new Error("Can't set value of a non-pending future.");
        }
        else {
            this.resolve(value);
            this.status = "resolved";
        }
    }
    setError(error) {
        if (this.status != "pending") {
            throw new Error("Can't set error of a non-pending future.");
        }
        else {
            this.reject(error);
            this.status = "rejected";
        }
    }
    flatMap(f) {
        let future = new Future();
        this.promise.then((value) => {
            let newFuture = f(value);
            newFuture.promise.then((value) => {
                future.setValue(value);
            }).catch((error) => {
                future.setError(error);
            });
        }).catch((error) => {
            future.setError(error);
        });
        return future;
    }
    map(f) {
        return this.flatMap((value) => Future.value(f(value)));
    }
    filter(f) {
        return this.flatMap((value) => {
            if (f(value)) {
                return Future.value(value);
            }
            else {
                return Future.error(new Error("Future filtered out."));
            }
        });
    }
    flatten() {
        return this.flatMap((value) => value);
    }
    isReady() {
        return this.status != "pending" && this.status != "initializing";
    }
    handle(rescueError) {
        let future = new Future();
        this.promise.then((value) => {
            future.setValue(value);
        }).catch((error) => {
            future.setValue(rescueError(error));
        });
        return future;
    }
    rescue(rescueError) {
        let future = new Future();
        this.promise.then((value) => {
            future.setValue(value);
        }).catch((error) => {
            let newFuture = rescueError(error);
            newFuture.promise.then((value) => {
                future.setValue(value);
            }).catch((error) => {
                future.setError(error);
            });
        });
        return future;
    }
    liftToTry() {
        return this.map((value) => new Return(value)).handle((error) => new Throw(error));
    }
    lowerFromTry() {
        return this.flatMap((value) => {
            if (value instanceof Try) {
                if (value.isReturn()) {
                    return Future.value(value.apply());
                }
                else {
                    return Future.error(value.apply());
                }
            }
            else {
                throw new Error("Can't lower a non-Try value.");
            }
        });
    }
}
