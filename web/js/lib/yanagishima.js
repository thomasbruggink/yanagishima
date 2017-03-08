var yanagishima_tree = (function (datasource) {
    var tree = $("#tree").dynatree({
        imagePath: "img",
        initAjax: {
            type: "POST",
            url: "presto",
            data: {"datasource":datasource, "query": "show catalogs"}
        },
        postProcess: function (data, dataType) {
            headers = data["headers"];
            results = data["results"];
            if (headers == "Catalog") {
                for (var i = 0; i < results.length; i++) {
                    var catalog = results[i][0];
                    var rootNode = $("#tree").dynatree("getRoot");
                    rootNode.addChild({title: catalog, key: catalog, isFolder: false, isLazy: true, catalog: catalog, icon: false, addClass: "fa fa-server"});
                }
            }
        },
        onLazyRead: function (node) {
            var param;
            if (node.data.catalog) {
                param = "show schemas from " + node.data.key;
            } else if (node.parent.data.catalog) {
                param = "SELECT table_catalog, table_schema, table_name, table_type FROM " + node.parent.data.catalog + ".information_schema.tables WHERE table_schema='" + node.data.key + "'";
            } else if (node.parent.data.schema) {
                param = "show columns from " + node.parent.parent.data.catalog + "." + node.parent.data.schema + "." + node.data.key;
            }
            $.ajax({
                url: "presto",
                data: {"datasource":datasource, query: param},
                type: "POST",
                dataType: "json"
            }).done(function (data) {
                if (data["error"]) {
                    console.log(data["error"]);
                    return;
                }
                headers = data["headers"];
                results = data["results"];
                if (headers == "Schema") {
                    for (var i = 0; i < results.length; i++) {
                        var result = results[i][0];
                        node.addChild({title: result, key: result, isLazy: true, isFolder: false, schema: result, icon: false, addClass: "fa fa-database"});
                    }
                } else if (headers[0] == "table_catalog") {
                    for (var i = 0; i < results.length; i++) {
                        var table_catalog = results[i][0];
                        var table_schema = results[i][1];
                        var table_name = results[i][2];
                        var table_type = results[i][3];
                        if(table_type === "BASE TABLE") {
                            node.addChild({title: table_name, key: table_name, isLazy: true, isFolder: false, table: table_name, icon: false, addClass: "fa fa-table"});
                        } else if(table_type === "VIEW") {
                            node.addChild({title: table_name, key: table_name, isLazy: true, isFolder: false, table: table_name, icon: false, addClass: "fa fa-eye"});
                        } else {
                            node.addChild({title: table_name, key: table_name, isLazy: true, isFolder: true, table: table_name});
                        }
                    }
                } else {
                    for (var i = 0; i < results.length; i++) {
                        var result = results[i][0];
                        node.addChild({title: result, key: result, isLazy: true, isFolder: false});
                    }
                }
                node.setLazyNodeStatus(DTNodeStatus_Ok);
            }).fail(function () {
                node.data.isLazy = false;
                node.setLazyNodeStatus(DTNodeStatus_Ok);
                node.render();
            });
        },
        onCreate: function (node, span) {
            if (node.data.table) {
                $(span).contextMenu({menu: "tableMenu"}, function (action, el, pos) {
                    table = node.data.table;
                    schema = node.parent.data.schema;
                    catalog = node.parent.parent.data.catalog;
                    if (action === "select") {
                        query = "SELECT * FROM " + catalog + "." + schema + "." + table + " LIMIT 100";
                        window.editor.setValue(query);
                        $("#query-submit").click();
                    } else if (action === "select_no_execute") {
                        query = "SELECT * FROM " + catalog + "." + schema + "." + table + " LIMIT 100";
                        window.editor.setValue(query);
                    } else if (action === "select_where") {
                        select_data(datasource, "SELECT * FROM", catalog, schema, table, true);
                    } else if (action === "select_where_no_execute") {
                        select_data(datasource, "SELECT * FROM", catalog, schema, table, false);
                    } else if (action === "select_count_where") {
                        select_data(datasource, "SELECT COUNT(*) FROM", catalog, schema, table, true);
                    } else if (action === "select_count_where_no_execute") {
                        select_data(datasource, "SELECT COUNT(*) FROM", catalog, schema, table, false);
                    } else if (action === "partitions") {
                        query = "SHOW PARTITIONS FROM " + catalog + "." + schema + "." + table;
                        window.editor.setValue(query);
                        $("#query-submit").click();
                    } else if (action === "show_view_ddl") {
                        query = "SELECT view_definition FROM " + catalog + ".information_schema.views WHERE table_catalog='" + catalog + "' AND table_schema='" + schema + "' AND table_name='" + table + "'";
                        window.editor.setValue(query);
                        $("#query-submit").click();
                    } else if (action === "describe") {
                        query = "DESCRIBE " + catalog + "." + schema + "." + table;
                        window.editor.setValue(query);
                        $("#query-submit").click();
                    } else if (action === "show_create_table") {
                        query = "SHOW CREATE TABLE " + catalog + "." + schema + "." + table;
                        window.editor.setValue(query);
                        $("#query-submit").click();
                    }
                });
            }
        }
    });
    return tree;
});

var select_data = (function (datasource, select_query, catalog, schema, table, execute_flag) {
    partition_query = "SHOW PARTITIONS FROM " + catalog + "." + schema + "." + table;
    var requestURL = "/presto";
    var requestData = {
        "query": partition_query,
        "datasource": datasource
    };
    var successHandler = function (data) {
        if (data.error) {
            $("#error-msg").text(data.error);
            $("#error-msg").slideDown("fast");
        } else if (data.warn) {
            $("#warn-msg").text(data.warn);
            $("#warn-msg").slideDown("fast");
        } else {
            var partition_column = data.headers;
            if (partition_column.length == 0) {
                query = select_query + " " + catalog + "." + schema + "." + table + " LIMIT 100";
                window.editor.setValue(query);
                $("#query-submit").click();
                return;
            }
            var rows = data.results;
            rows.sort(
                function(a, b) {
                    if(a < b) return -1;
                    if(a > b) return 1;
                    return 0;
                }
            );
            var latest_partition = rows[rows.length - 1];
            var where = " WHERE ";
            for (var i = 0; i < partition_column.length; ++i) {
                if (typeof latest_partition[i] === "string") {
                    where += partition_column[i] + "=" + "'" + latest_partition[i] + "'";
                } else {
                    where += partition_column[i] + "=" + latest_partition[i];
                }
                if (i != partition_column.length - 1) {
                    where += " AND "
                }
            }
            query = select_query + " " + catalog + "." + schema + "." + table + where + " LIMIT 100";
            window.editor.setValue(query);
            if (execute_flag) {
                $("#query-submit").click();
            }
        }
    };
    $.post(requestURL, requestData, successHandler, "json");
});

var selectLine = (function (n) {
    window.editor.addLineClass(n-1, 'wrap', 'CodeMirror-errorline-background')
});

var table_search = (function () {
    query = "SELECT table_cat AS catalog, table_schem AS schema, table_name AS table_name FROM system.jdbc.tables WHERE table_type='TABLE' and table_name LIKE '%" + $("#table_name").val() + "%'";
    window.editor.setValue(query);
    $("#query-submit").click();
});


var switch_datasource = (function () {
    var datasource = $('#select_datasource option:selected').text();
    $("#tree").dynatree("destroy");
    var tree = yanagishima_tree(datasource);
    redraw(datasource);
    update_query_histories_area(datasource);
});

var handle_execute = (function () {
    var line_count = window.editor.lineCount();
    for (var i=0; i<line_count; i++) {
        window.editor.removeLineClass(i, 'wrap', 'CodeMirror-errorline-background');
    }
    $("#query-submit").attr("disabled", "disabled");
    $("#query-explain").attr("disabled", "disabled");
    $("#query-explain-distributed").attr("disabled", "disabled");
    $("#query-clear").attr("disabled", "disabled");
    $("#query-format").attr("disabled", "disabled");
    $("#tsv-download").attr("disabled", "disabled");
    $("#query-results-div").remove();
    var div = $("<div></div>", {id: "query-results-div"});
    div.append($("<table></table>", {class: "table table-bordered", id: "query-results"}));
    $("#query-results-tab").append(div);
    $("#error-msg").hide();
    $("#warn-msg").hide();
    $("#query-result-size-line").hide();
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    var img = document.createElement("img");
    $(img).attr("src", "img/loading_long_48.gif");
    $(td).append(img);
    $(tr).append(td);
    $("#query-results").append(tr);
    var query = window.editor.getValue();
    var datasource = $('#select_datasource option:selected').text();
    var requestURL = "/presto";
    var requestData = {
        "query": query,
        "datasource": datasource
    };
    var successHandler = function (data) {
        $("#query-submit").removeAttr("disabled");
        $("#query-explain").removeAttr("disabled");
        $("#query-explain-distributed").removeAttr("disabled");
        $("#query-clear").removeAttr("disabled");
        $("#query-format").removeAttr("disabled");
        if (data.error) {
            $("#error-msg").text(data.error);
            $("#error-msg").slideDown("fast");
            $("#query-results").empty();
            selectLine(data.errorLineNumber);
            update_history_by_query(datasource, data.queryid);
        } else {
            if (data.warn) {
                $("#warn-msg").text(data.warn);
                $("#warn-msg").slideDown("fast");
            }
            update_history_by_query(datasource, data.queryid);
            push_query(datasource, query, data.queryid);
            $("#query-histories").empty();
            $("#yanagishima-query-histories").empty();
            update_query_histories_area(datasource);
            $("#query-results").empty();
            var headers = data.headers;
            var rows = data.results;
            if (data.rawDataSize && data.lineNumber && data.elapsedTimeMillis) {
                $("#rawDataSize").text(data.rawDataSize);
                $("#lineNumber").text(data.lineNumber);
                $("#elapsed").text(formatDuration(data.elapsedTimeMillis));
                $("#query-result-size-line").show();
            }
            var show_ddl_flag=false;
            if(query.match("SELECT view_definition FROM [a-zA-Z0-9]+\.information_schema\.views")) {
                show_ddl_flag=true;
            }
            if(query.startsWith("SHOW CREATE TABLE")) {
                show_ddl_flag=true;
            }
            if(query.startsWith("SELECT table_cat AS catalog, table_schem AS schema, table_name AS table_name FROM system.jdbc.tables WHERE table_type='TABLE' and table_name LIKE")) {
                var thead = document.createElement("thead");
                var tr = document.createElement("tr");
                for (var i = 0; i < headers.length; ++i) {
                    var th = document.createElement("th");
                    $(th).text(headers[i]);
                    $(tr).append(th);
                }
                var th = document.createElement("th");
                $(th).text("");
                $(tr).append(th);
                var th = document.createElement("th");
                $(th).text("");
                $(tr).append(th);
                var th = document.createElement("th");
                $(th).text("");
                $(tr).append(th);
                var th = document.createElement("th");
                $(th).text("");
                $(tr).append(th);
                $(thead).append(tr);
                $("#query-results").append(thead);
                var tbody = document.createElement("tbody");
                for (var i = 0; i < rows.length; ++i) {
                    var columns = rows[i];
                    var tr = document.createElement("tr");
                    for (var j = 0; j < columns.length; ++j) {
                        var td = document.createElement("td");
                        $(td).text(columns[j]);
                        $(tr).append(td);
                    }
                    var td = document.createElement("td");
                    var select_button = document.createElement("button");
                    $(select_button).attr("type", "button");
                    $(select_button).attr("class", "btn btn-success");
                    $(select_button).text("select");
                    var select_query = "SELECT * FROM " + columns[0] + "." + columns[1] + "." + columns[2] + " LIMIT 100";
                    $(select_button).click({query: select_query}, execute_select_query);
                    $(td).append(select_button);
                    $(tr).append(td);
                    var td = document.createElement("td");
                    var select_button = document.createElement("button");
                    $(select_button).attr("type", "button");
                    $(select_button).attr("class", "btn btn-success");
                    $(select_button).text("select latest partition");
                    $(select_button).click({datasource: datasource, catalog: columns[0], schema: columns[1], table: columns[2]}, execute_select_query_latest_partition);
                    $(td).append(select_button);
                    $(tr).append(td);
                    var td = document.createElement("td");
                    var show_columns_button = document.createElement("button");
                    $(show_columns_button).attr("type", "button");
                    $(show_columns_button).attr("class", "btn btn-success");
                    $(show_columns_button).attr("data-load", "/presto");
                    $(show_columns_button).text("show columns");
                    $(show_columns_button).click({catalog: columns[0], schema: columns[1], table: columns[2]}, show_columns);
                    $(td).append(show_columns_button);
                    $(tr).append(td);
                    var td = document.createElement("td");
                    var show_presto_view_ddl_button = document.createElement("button");
                    $(show_presto_view_ddl_button).attr("type", "button");
                    $(show_presto_view_ddl_button).attr("class", "btn btn-success");
                    $(show_presto_view_ddl_button).text("show presto view ddl");
                    $(show_presto_view_ddl_button).click({catalog: columns[0], schema: columns[1], table: columns[2]}, show_presto_view_ddl);
                    $(td).append(show_presto_view_ddl_button);
                    $(tr).append(td);
                    $(tbody).append(tr);
                }
                $("#query-results").append(tbody);
            } else {
                create_table("#query-results", headers, rows, show_ddl_flag);
            }
            $("#tsv-download").removeAttr("disabled");
        }
    };
    $.post(requestURL, requestData, successHandler, "json");
});

var execute_select_query = (function (event) {
    window.editor.setValue(event.data.query);
    $("#query-submit").click();
});

var execute_select_query_latest_partition = (function (event) {
    select_data(event.data.datasource, "SELECT * FROM", event.data.catalog, event.data.schema, event.data.table, true);
});

var show_columns = (function (event) {
    var query = "DESCRIBE " + event.data.catalog + "." + event.data.schema + "." + event.data.table;
    var datasource = $('#select_datasource option:selected').text();
    var requestData = {
        "query": query,
        "datasource": datasource
    };
    var button = $(this);
    if (! button.data('loaded')) {
        $.post(button.data('load'), requestData, function(data){
            var field_rows_html = data.results.map(function(t){
                return '<tr style="border:none;"><td>' + t[0] + '</td><td>' + t[1] + '</td></tr>';
            }).join('');
            var table_html = '<table class="target-columns" style="border: 0; width: 100%;">'
                + '<tr><th>Column</th><th>Type</th></tr>'
                + field_rows_html
                + '</table>';
            button.attr('data-loaded', 'true');
            button.popover({
                html: true,
                template: '<div class="popover" role="tooltip" style="overflow-y: scroll;"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>',
                content: table_html
            }).popover('toggle');
            $('table.target-columns').closest('div').css('padding', '0');
        });
        event.preventDefault();
    }
});

var show_presto_view_ddl = (function (event) {
    query = "SELECT view_definition FROM " + event.data.catalog + ".information_schema.views WHERE table_catalog='" + event.data.catalog + "' AND table_schema='" + event.data.schema + "' AND table_name='" + event.data.table + "'";
    window.editor.setValue(query);
    $("#query-submit").click();
});

var handle_explain = (function () {
    explain("");
});

var handle_explain_distributed = (function () {
    explain("distributed");
});

var handle_explain_analyze = (function () {
    explain("analyze");
});

var explain = (function (kind) {
    $("#tsv-download").attr("disabled", "disabled");
    window.editor.removeLineClass(window.editor.listSelections()[0].head.line, 'wrap', 'CodeMirror-errorline-background');
    $("#query-results").empty();
    $("#error-msg").hide();
    $("#warn-msg").hide();
    var query;
    if (kind == "distributed") {
        query = "explain (type distributed) " + window.editor.getValue();
    } else if (kind == "analyze") {
        query = "explain analyze " + window.editor.getValue();
    } else {
        query = "explain " + window.editor.getValue();
    }
    var requestURL = "/presto";
    var datasource = $('#select_datasource option:selected').text();
    var requestData = {
        "query": query,
        "datasource": datasource
    };
    var successHandler = function (data) {
        if (data.error) {
            $("#error-msg").text(data.error);
            $("#error-msg").slideDown("fast");
            $("#query-results").empty();
            selectLine(data.errorLineNumber);
        } else {
            if (data.warn) {
                $("#warn-msg").text(data.warn);
                $("#warn-msg").slideDown("fast");
            }
            $("#query-results-div").remove();
            var div = $("<div></div>", {style: "height:500px; overflow:auto;", id: "query-results-div"});
            div.append($("<table></table>", {class: "table table-bordered", id: "query-results"}));
            $("#query-results-tab").append(div);
            var headers = data.headers;
            var rows = data.results;
            var thead = document.createElement("thead");
            var tr = document.createElement("tr");
            for (var i = 0; i < headers.length; ++i) {
                var th = document.createElement("th");
                $(th).text(headers[i]);
                $(tr).append(th);
            }
            $(thead).append(tr);
            $("#query-results").append(thead);
            var tbody = document.createElement("tbody");
            for (var i = 0; i < rows.length; ++i) {
                var tr = document.createElement("tr");
                var columns = rows[i];
                for (var j = 0; j < columns.length; ++j) {
                    var pre = document.createElement("pre");
                    $(pre).text(columns[j]);
                    var td = document.createElement("td");
                    $(td).append(pre);
                    $(tr).append(td);
                }
                $(tbody).append(tr);
            }
            $("#query-results").append(tbody);
        }
    };
    $.post(requestURL, requestData, successHandler, "json");
});

var query_clear = (function () {
    window.editor.setValue("");
});

var query_format = (function () {
    window.editor.removeLineClass(window.editor.listSelections()[0].head.line, 'wrap', 'CodeMirror-errorline-background');
    $("#error-msg").hide();
    $("#warn-msg").hide();
    var query = window.editor.getValue();
    var requestURL = "/format";
    var datasource = $('#select_datasource option:selected').text();
    var requestData = {
        "query": query,
        "datasource": datasource
    };
    var successHandler = function (data) {
        if (data.error) {
            $("#error-msg").text(data.error);
            $("#error-msg").slideDown("fast");
            selectLine(data.errorLineNumber);
        } else {
            var format_query = data.formattedQuery;
            window.editor.setValue(format_query);
        }
    };
    $.post(requestURL, requestData, successHandler, "json");
});

var tsv_download = (function () {
    var param = document.location.search.substring(1);
    if (param === null) {
        return;
    }
    var element = param.split('=');
    var queryid = element[1];

    var link = document.createElement('a');
    var datasource = $('#select_datasource option:selected').text();
    link.href = "/download?queryid=" + queryid + "&datasource=" + datasource;
    link.click();
});

var push_query = (function (datasource, query, queryid) {
    if (!window.localStorage) return;
    var query_info_list = your_query_histories(datasource);
    var query_info = {queryid: queryid, query: query};
    query_info_list.unshift(query_info);
    set_your_query_histories(datasource, query_info_list.slice(0, 1000000));

});

var your_query_histories = (function (datasource) {
    if (!window.localStorage) return [];
    var history_map = {};
    history_map[datasource] = [];
    try {
        var json_str = window.localStorage.your_query_histories;
        if (json_str && json_str.length > 0) {
            history_map = JSON.parse(json_str);
        } else {
            set_your_query_histories(datasource, []);
        }
    } catch (e) {
        console.log(e);
        set_your_query_histories(datasource, []);
    }

    if(history_map[datasource] === null || history_map[datasource] === undefined) {
        history_map[datasource] = [];
    }

    return history_map[datasource];
});

var set_your_query_histories = (function (datasource, query_info_list) {
    if (!window.localStorage) return;
    var history_map = {};
    history_map[datasource] = [];
    try {
        var json_str = window.localStorage.your_query_histories;
        if (json_str && json_str.length > 0) {
            history_map = JSON.parse(json_str);
        }
    } catch (e) {
        console.log(e);
    }
    history_map[datasource] = query_info_list;
    window.localStorage.your_query_histories = JSON.stringify(history_map);
});

var update_query_histories_area = (function (datasource) {
    $("#query-histories").empty();
    var tbody = document.createElement("tbody");
    var query_info_list = your_query_histories(datasource);
    for (var i = 0; i < query_info_list.length; i++) {
        var tr = document.createElement("tr");
        var td = document.createElement("td");
        var queryid = query_info_list[i]["queryid"]
        var query = query_info_list[i]["query"]
        var link = document.createElement('a')
        link.href = "?queryid=" + queryid + "&datasource=" + datasource;
        link.text = queryid;
        link.style = "color: #337ab7";
        link.target = "_blank";
        $(td).append(link);
        $(tr).append(td);

        var copy_button = document.createElement("button");
        $(copy_button).attr("type", "button");
        $(copy_button).attr("class", "btn btn-success");
        $(copy_button).text("copy to query area");
        $(copy_button).click({query: query}, copy_query);
        var td = document.createElement("td");
        $(td).append(copy_button);
        $(tr).append(td);
        var delete_button = document.createElement("button");
        $(delete_button).attr("type", "button");
        $(delete_button).attr("class", "btn btn-info");
        $(delete_button).text("delete");
        $(delete_button).click({index: i}, delete_query);
        var td = document.createElement("td");
        $(td).append(delete_button);
        $(tr).append(td);
        var td = document.createElement("td");
        $(td).text(query);
        $(tr).append(td);
        $(tbody).append(tr);
    }
    $("#query-histories").append(tbody);
});

var copy_query = (function (event) {
    window.editor.setValue(event.data.query);
});

var delete_query = (function (event) {
    if (!window.localStorage) return;
    var datasource = $('#select_datasource option:selected').text();
    var query_list = your_query_histories(datasource);
    query_list.splice(event.data.index, 1);
    set_your_query_histories(datasource, query_list);
    $("#query-histories").empty();
    update_query_histories_area(datasource);
});

var create_table = (function (table_id, headers, rows, show_ddl_flag) {
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    for (var i = 0; i < headers.length; ++i) {
        var th = document.createElement("th");
        $(th).text(headers[i]);
        $(tr).append(th);
    }
    $(thead).append(tr);
    $(table_id).append(thead);
    var tbody = document.createElement("tbody");
    for (var i = 0; i < rows.length; ++i) {
        var tr = document.createElement("tr");
        var columns = rows[i];
        for (var j = 0; j < columns.length; ++j) {
            var td = document.createElement("td");
            if (typeof columns[j] == "object") {
                $(td).text(JSON.stringify(columns[j]));
            } else {
                if(show_ddl_flag == true) {
                    $(td).html('<p>' + columns[j].replace(/\r?\n/g, "<br />") + '</p>');
                } else {
                    $(td).text(columns[j]);
                }
            }
            $(tr).append(td);
        }
        $(tbody).append(tr);
    }
    $(table_id).append(tbody);
    $(table_id).tablefix({fixRows: 1});
    $("#jquery-ui-tabs").attr("id", "dummy");

});

var redraw = (function () {
    var datasource = $('#select_datasource option:selected').text();
    var url = "/query?datasource=" + datasource;
    d3.json(url, function (queries) {
        var runningQueries = [];
        var doneQueries = [];
        if (queries) {
            runningQueries = queries.filter(function (query) {
                return query.state != 'FINISHED' && query.state != 'FAILED' && query.state != 'CANCELED';
            });
            doneQueries = queries.filter(function (query) {
                return query.state == 'FINISHED' || query.state == 'FAILED' || query.state == 'CANCELED';
            });
        }
        renderRunningQueries(runningQueries);
        renderDoneQueries(doneQueries, "#first_tab_done");
    });
});

var renderRunningQueries = (function (queries) {
    var tbody = d3.select("#running").select("tbody");
    var datasource = $('#select_datasource option:selected').text();

    tbody.remove();

    for (var i = 0; i < queries.length; i++) {
        var tr = document.createElement("tr");
        $(tr).attr("class", "info");

        queryInfo = queries[i];
        var splits = queryInfo.queryStats.totalDrivers;
        var completedSplits = queryInfo.queryStats.completedDrivers;

        var runningSplits = queryInfo.queryStats.runningDrivers;
        var queuedSplits = queryInfo.queryStats.queuedDrivers;

        var query = queryInfo.query;

        var progress = "N/A";
        if (queryInfo.scheduled) {
            progress = d3.format("%")(splits == 0 ? 0 : completedSplits / splits);
        }

        var kill_td = document.createElement("td");
        var kill_button = document.createElement("button");
        $(kill_button).attr("type", "button");
        $(kill_button).text("kill");
        $(kill_button).click({query: queryInfo}, kill_query);
        $(kill_td).append(kill_button);
        $(tr).append(kill_td);

        var queryid_td = document.createElement("td");
        var link = document.createElement('a')
        link.href = "/queryDetail?queryId=" + queryInfo.queryId + "&datasource=" + datasource;
        link.text = queryInfo.queryId;
        link.style = "color: #337ab7";
        link.target = "_blank";
        $(queryid_td).append(link);
        $(tr).append(queryid_td);

        var elapsed_td = document.createElement("td");
        $(elapsed_td).text(queryInfo.queryStats.elapsedTime);
        $(tr).append(elapsed_td);

        var query_td = document.createElement("td");
        $(query_td).text(query);
        $(tr).append(query_td);

        var source_td = document.createElement("td");
        $(source_td).text(queryInfo.session.source);
        $(tr).append(source_td);

        var user_td = document.createElement("td");
        $(user_td).text(queryInfo.session.user);
        $(tr).append(user_td);

        var state_td = document.createElement("td");
        $(state_td).text(queryInfo.state);
        $(tr).append(state_td);

        var progress_td = document.createElement("td");
        $(progress_td).text(progress);
        $(tr).append(progress_td);

        var queuedSplits_td = document.createElement("td");
        $(queuedSplits_td).text(queuedSplits);
        $(tr).append(queuedSplits_td);

        var runningSplits_td = document.createElement("td");
        $(runningSplits_td).text(runningSplits);
        $(tr).append(runningSplits_td);

        var completedSplits_td = document.createElement("td");
        $(completedSplits_td).text(completedSplits);
        $(tr).append(completedSplits_td);

        $("#running").append(tr);

    }

});

var kill_query = (function (event) {
    query = event.data.query;
    var datasource = $('#select_datasource option:selected').text();
    if (query.session.source == 'yanagishima') {
        d3.xhr("/kill?queryId=" + query.queryId + "&datasource=" + datasource).send('GET');
    } else {
        if(confirm("You are killing the query from non yanagishima user.\nIs it OK?")) {
            d3.xhr("/kill?queryId=" + query.queryId + "&datasource=" + datasource).send('GET');
        }
    }
});

var renderDoneQueries = (function (queries, table_id) {
    var tbody = d3.select(table_id).select("tbody");
    var datasource = $('#select_datasource option:selected').text();

    var rows = tbody.selectAll("tr")
        .data(queries, function (query) {
            return query.queryId;
        });

    rows.enter()
        .append("tr")
        .attr("class", function (query) {
            switch (query.state) {
                case "FINISHED":
                    return "success";
                case "FAILED":
                    return "danger";
                case "CANCELED":
                    return "warning";
                default:
                    return "info";
            }
        })
        .append("td")
        .append('a')
        .attr("href", function (query) {
           return "/queryDetail?queryId=" + query.queryId + "&datasource=" + datasource;
         })
        .attr("target", "_blank")
        .attr("style", "color: #337ab7")
        .text(function (query) {
           return query.queryId;
         });

    rows.exit()
        .remove();

    rows.selectAll("td")
        .data(function (queryInfo) {
            var splits = queryInfo.queryStats.totalDrivers;
            var completedSplits = queryInfo.queryStats.completedDrivers;

            var query = queryInfo.query;
            //if (query.length > 200) {
            //    query = query.substring(0, 200) + "...";
            //}

            return [
                queryInfo.queryId,
                queryInfo.queryStats.elapsedTime,
                query,
                queryInfo.session.source,
                queryInfo.session.user,
                queryInfo.state,
                shortErrorType(queryInfo.errorType),
                completedSplits,
                splits,
                d3.format("%")(splits == 0 ? 0 : completedSplits / splits)
            ]
        })
        .enter()
        .append("td")
        .text(function (d) {
            return d;
        });

    tbody.selectAll("tr")
        .sort(function (a, b) {
            return d3.descending(a.queryStats.endTime, b.queryStats.endTime);
        });
});

var shortErrorType = (function (errorType) {
    switch (errorType) {
        case "USER_ERROR":
            return "USER";
        case "INTERNAL_ERROR":
            return "INTERNAL";
        case "INSUFFICIENT_RESOURCES":
            return "RESOURCES";
    }
    return errorType;
});

function update_history_by_query(datasource, queryid) {
    if (! window.history.pushState ) // if pushState not ready
        return;
    if (queryid === null) {
        window.history.pushState('','', '/');
        return;
    }
    window.history.pushState(queryid, '', '?queryid=' + queryid + '&datasource=' + datasource);
};

function follow_current_uri() {
    var param = document.location.search.substring(1);
    if (param === null) {
        return;
    }
    var element = param.split('&');
    if (element.length != 2) {
        return;
    }
    var queryid = element[0].split('=')[1];
    if (queryid === null || queryid === undefined) {
        return;
    }
    var datasource = element[1].split('=')[1];
    if (datasource === null || datasource === undefined) {
        return;
    }
    follow_current_uri_query(queryid, datasource);
};

function follow_current_uri_query(queryid, datasource){
    $.get("/history", {queryid: queryid, datasource: datasource}, function (data) {
        window.editor.setValue(data.queryString);
        if (data.error) {
            $("#error-msg").text(data.error);
            $("#error-msg").slideDown("fast");
        } else {
            if (data.warn) {
                $("#warn-msg").text(data.warn);
                $("#warn-msg").slideDown("fast");
            }
            if (data.rawDataSize && data.lineNumber && data.elapsedTimeMillis) {
                $("#rawDataSize").text(data.rawDataSize);
                $("#lineNumber").text(data.lineNumber);
                $("#elapsed").text(formatDuration(data.elapsedTimeMillis));
                $("#query-result-size-line").show();
            }
            $("#query-results").empty();
            create_table("#query-results", data.headers, data.results, false);
            $("#tsv-download").removeAttr("disabled");
        }
    });
};

function precisionRound(n) {
    if (n < 10) {
        return n.toFixed(2);
    }
    if (n < 100) {
        return n.toFixed(1);
    }
    return Math.round(n);
};

function formatDuration(duration) {
    var unit = "ms";
    if (duration > 1000) {
        duration /= 1000;
        unit = "s";
    }
    if (unit == "s" && duration > 60) {
        duration /= 60;
        unit = "m";
    }
    if (unit == "m" && duration > 60) {
        duration /= 60;
        unit = "h";
    }
    if (unit == "h" && duration > 24) {
        duration /= 24;
        unit = "d";
    }
    if (unit == "d" && duration > 7) {
        duration /= 7;
        unit = "w";
    }
    return precisionRound(duration) + unit;
};