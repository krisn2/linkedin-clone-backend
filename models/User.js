
const {Schema, model} = require("mongoose")
const bcrypt = require("bcryptjs")


const UserSchema = new Schema({
    name: {type:String, requried: true, trim: true},
    email: {type: String, required:true, unique:true, lowercase:true, trim:true},
    password: {type:String, required:true},
    headline: {type:String, default: ''},
    bio: {type: String, default: ''},
    avatar: {type:String, default:''},
}, {timestamps:true})


UserSchema.pre('save', async function (next) {
    if(!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
})

UserSchema.methods.comparePassword = function(plain) {
    return bcrypt.compare(plain, this.password);
}

module.exports = model('User', UserSchema);