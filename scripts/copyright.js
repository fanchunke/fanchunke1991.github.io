// Add a tail to every post from tail.md
// Great for adding copyright info
var fs = require('fs');
hexo.extend.filter.register('before_post_render', function(data){
    if(data.copyright == false) return data;
    var file_content = fs.readFileSync('copyright.md');
    if(file_content && data.content.length > 50) 
    {
        data.content += file_content;
        var permalink = '\n本文永久链接：' + data.permalink;
        data.content += permalink;
    }
    return data;
});