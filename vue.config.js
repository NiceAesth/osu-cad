const Dotenv = require('dotenv-webpack');

module.exports = {
    chainWebpack: config => {
        const imgRule = config.module.rule('images')
        imgRule.uses.clear()
        imgRule.use('file-loader')
            .loader('file-loader')

    },
    webPackConfig: {
        plugins: [
            new Dotenv()
        ],
    },
    css: {
        loaderOptions: {
            sass: {
                prependData: `
                    @import "@/_variables.scss";
                `
            }
        },
    }
}
