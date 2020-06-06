
function toJson(data: Response) {
    return data.json();
}

const maxRetry = 3;
const retry = {
    count: 0
};

const [swaggerJsonUrl, cookie, apiPath, functionName, output = `${Deno.cwd()}/api.ts`] = Deno.args;

function fetchSwaggerJson(url: string, cookie?: string): any {
    return fetch(url, { method: 'GET', ...(cookie && { headers: { 'Cookie': cookie } }) }) .then(toJson)
    .then((json) => {
        if (json.status == 401 || json.error === 'Unauthorized') {
            throw new Error('Unauthorized 该地址需要授权访问');
        }
        return json;
    })
    .catch((error) => {
        if (error.message === 'Unauthorized 该地址需要授权访问' && retry.count <= maxRetry && cookie) {
            // 尝试 使用指定 cookie 登录
            console.log('尝试使用cookie 重试', retry.count);
            retry.count += 1;
            return fetchSwaggerJson(url, cookie);
        }
        return Promise.reject(error.message)
    });
}

const apiBuildTpl = `
/**
 * #summary#
 * #is_deprecated#
 */ 
export function #method##func_name#(config: {
    path: #pathType#;
    params: #queryType#;
    data: #dataType#;
}) {
    const { path, ...others } = config;
    return ApiBuilder.build(\`\${API_URL()}#api_path#\`, {
        method: '#method#',
        ...others
    });
}
`;

function convertApiInfo(apiInfo: Record<string, any>) {
    return Object.entries(apiInfo).map(([method, info]) => {
        /** consumes 对应 Content-Type produces 对应 Accept 但是这俩现在一般用不上 */
        const { consumes, produces, deprecated, parameters, summary } = info;
        const [pathParams, queryParams, bodyParams] = splitSwaggerParams(parameters);
        const hasPathParams = pathParams.length > 0;
        return apiBuildTpl.replace(/#method#/g, method)
                          .replace(/#is_deprecated#/m, !deprecated ? '' : '@deprecated')
                          .replace(/#pathType#/, pathParams)
                          .replace(/^    const { path, ...others } = config;$/m, !hasPathParams ? unary(always('    const others = config;')) : unary(identity))
                          .replace(/#queryType#/, queryParams)
                          .replace(/#dataType#/, bodyParams)
                          .replace(/^\s{4}path: ;\n/m, '')
                          .replace(/^\s{4}params: ;\n/m, '')
                          .replace(/^\s{4}data: ;\n/m, '')
                          .replace(/#summary#/, summary)

    });
}

interface Parameter {
    name: string;
    in: 'query' | 'body' | 'path';
    required: boolean;
    schema?: { '$ref': string };
    type?: string;
}
function splitSwaggerParams(parameters: Parameter[]) {
    const [pathParams, queryParams, bodyParams] = parameters.reduce((acc, param) => {
        if (param.in === 'path') {
            acc[0].push(param);
        } else if (param.in === 'query' ){
            acc[1].push(param);
        } else {
            acc[2].push(param);
        }
        return acc;
    }, [[], [], []] as [Parameter[], Parameter[], Parameter[]]);
    return [pathParams, queryParams, bodyParams].map(splitRequiredParam);
}

function splitRequiredParam(parameters: Parameter[]) {
    if (parameters.length === 0) {
        return '';
    }
    const pairs = parameters.map((param) => {
        return `${param.name}${param.required ? ':' : '?:'} ${param.type ?? param.schema?.$ref};`;
    }).join(' ');
    return `{ ${pairs} }`;
}

function unary<T, R>(func: (arg: T, ...args: any[]) => R): (arg: T) => R {
    return (arg) => func(arg)
}

function identity<T>(arg: T): T {
    return arg;
}

function always<T>(arg: T): (...arg: any[]) => T {
    return (...args: any[]) => {
        return arg;
    };
}

import.meta.main && fetchSwaggerJson(swaggerJsonUrl, cookie).then((data: any) => {
    const { paths } = data;
    const apiInfo = paths[apiPath];
    const encoder = new TextEncoder();
    const code = convertApiInfo(apiInfo)
    .map((functionFragment) => {
        return functionFragment
        .replace(
            /#api_path#/g,
            apiPath.replace(/{(.*?)}/g, '${path.$1}').replace(/\/api\/v[12]/, '')
        ).replace(
            /#func_name#/,
            functionName.split('').map((a, i) => i === 0 ? String(a).toUpperCase() : a).join('')
        );
    })
    .join('\n')
    const txt = encoder.encode(code);

    return Deno.writeFile(output, txt, { append: true });
});
