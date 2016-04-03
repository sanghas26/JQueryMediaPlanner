(function ($) {
    $.fn.hoerbigerCalendar = function () {
        /*INTIALIZATION*/
        var _queryString = {};
        var _currentYear = new Date().getFullYear();
        var _filterIds = [];
        getQuerystringAndSetDefaults();
        this.find('#txtCalendarYear').text(_currentYear);
        var _tableBody = this.find('#table-body');
        //keep track of last table cell so when item view is switched we can draw div next to table cell
        var _lastClickedTableCell = null;

        getFilters().then(function (data) {
            setFilters(data);
        });
        getPlannerSummary(_filterIds).then(function (data) {
            plotCalendar(data);
        });

        function getQuerystringAndSetDefaults() {
            if (window.location.search.indexOf('?q=') > -1) {
                var url = window.location.search.substring(window.location.search.indexOf('?q=') + 3);
                var queryStringObject = JSON.parse(decodeURIComponent(url));
                _queryString = queryStringObject;
                _filterIds = _queryString.filters;
                _currentYear = _queryString.y;
            }
        }

        function setQuerystring() {
            _queryString = {
                y: _currentYear,
                filters: _filterIds
            }
            var encodedQuerystring = encodeURIComponent(JSON.stringify(_queryString));
            window.history.pushState(_queryString, '', '?q=' + encodedQuerystring);
        }

        function getFilters() {
            return jQuery.post(
                "/DesktopModules/MediaPlanner/API/MediaPlannerData/GetFilter"
            ).done(function (data) {
                return {
                    then: function (callback) {
                        return callback(data);
                    }
                }
            });
        }

        function getPlannerSummary() {
            var dataObj = {
                "StartDateTime": '01-01-' + _currentYear,
                "EndDateTime": '01-01-' + (_currentYear + 1),
                "FilterIds": _filterIds
            };
            return jQuery.post(
                "/DesktopModules/MediaPlanner/API/MediaPlannerData/GetMediaPlannerSummary",
                dataObj
            ).done(function (data) {
                return {
                    then: function (callback) {
                        return callback(data);
                    }
                }
            });
        }

        //populate filters based on response object, plus add the onChange event handlers
        function setFilters(filters) {
            var $ddlProducts = $('#ddlProducts');
            filters.ProductFilterItems.forEach(function (item) {
                $ddlProducts.append($('<option/>').val(item.LabelId).text(item.LabelValue));
                if (_filterIds.indexOf(item.LabelId) > -1) {
                    $ddlProducts.val(parseInt(item.LabelId));
                }
            });
            $ddlProducts.on('change', changeFilter);

            var $ddlPublications = $('#ddlPublications');
            filters.PublicationsFilterItems.forEach(function (item) {
                $ddlPublications.append($('<option/>').val(item.LabelId).text(item.LabelValue));
                if (_filterIds.indexOf(item.LabelId) > -1) {
                    $ddlPublications.val(parseInt(item.LabelId));
                }
            });
            $ddlPublications.on('change', changeFilter);

            var $ddlRegions = $('#ddlRegions');
            filters.RegionFilterItems.forEach(function (item) {
                $ddlRegions.append($('<option/>').val(item.LabelId).text(item.LabelValue));
                if (_filterIds.indexOf(item.LabelId) > -1) {
                    $ddlRegions.val(parseInt(item.LabelId));
                }
            });
            $ddlRegions.on('change', changeFilter);
        }

        function changeFilter() {
            _filterIds = [parseInt($('#ddlProducts').val()), parseInt($('#ddlPublications').val()), parseInt($('#ddlRegions').val())];
            _filterIds = _filterIds.filter(Boolean);
            setQuerystring();
            getPlannerSummary(_filterIds).then(function (data) {
                plotCalendar(data);
            });
        }

        function plotCalendar(summary) {
            clearCalendar();
            //set active month column css
            var currentMonthInt = (new Date()).getMonth();
            ($('#tbl-header th')[currentMonthInt + 1]).className = 'active';

            plot(summary.Events, 'eventsRow');
            plot(summary.OnlineAds, 'onlineadsRow');
            plot(summary.Presentations, 'presentationsRow');
            plot(summary.PressReleases, 'pressreleasesRow');
            plot(summary.PrintAds, 'printadsRow');
            plot(summary.PrintTechnicalPapers, 'printtechnicalpapersRow');
            plot(summary.EventTechnicalPapers, 'eventtechnicalpapersRow');
            plot(summary.Webiniar, 'webinarsRow');
        }

        function plot(items, rowName) {
            var row = _tableBody.find('#' + rowName);
            var index = 0;
            var d = new Date();
            var currentMonthInt = d.getMonth();
            var currentYearInt = d.getFullYear();

            for (var month in items) {
                //if this is populating for the current month, we need a mini table with two columns
                //representing "Active" items (before todays date) and "Planned" items (after todays date)
                if (currentMonthInt === index && _currentYear === currentYearInt) {
                    var filteredItems = getFilteredActivePlannedItems(items[month]);

                    var $cellTableContainer = $('<td></td>', {
                        class: 'cell-table-container'
                    });

                    var $innerTable = $('<table></table>')
                        .append($('<tr></tr>'))
                        .append($('<td></td>', {
                            class: 'active-campaign-cell',
                            text: filteredItems.activeItems.length,
                            click: (function (_items) {
                                return function () {
                                    mediaClick.apply(this, [_items]);
                                }
                            })(filteredItems.activeItems)
                        }))
                        .append($('<td></td>', {
                            class: 'planned-campaign-cell',
                            text: filteredItems.plannedItems.length,
                            click: (function (_items) {
                                return function () {
                                    mediaClick.apply(this, [_items]);
                                }
                            })(filteredItems.plannedItems)
                        }));

                    var $result = $cellTableContainer.append($innerTable);
                    $result.appendTo(row);
                } else {
                    $('<td></td>', {
                        id: rowName + '-' + index,
                        class: 'cell-data ' + ((index < currentMonthInt && _currentYear === currentYearInt) || _currentYear < currentYearInt ? 'active-campaign-cell' : 'planned-campaign-cell'),
                        click: (function (monthValue) {
                            return function () {
                                mediaClick.apply(this, [items[monthValue]]);
                            }
                        })(month)
                    }).appendTo(row)
                      .append(items[month].length);
                }
                index++;
            }
        }

        function mediaClick(mediaItems, mediaItemIndex) {
            mediaItemIndex = mediaItemIndex || 0;
            //first we delete the previous item detail view if it exists
            var $prevItemDetail = $('#itemDetail');
            if ($prevItemDetail.length > 0) {
                $prevItemDetail.remove();
            }

            _lastClickedTableCell = this;
            var jqEl = $(this);
            var jqPar = $('#calendar-container');

            if (mediaItems.length > 0) {
                var detailView = getDetail(mediaItems, mediaItemIndex);

                //append and set detail view's css after it has loaded
                detailView.appendTo(jqPar);

                //set max height after css has been applied
                var $itemViewContainer = $('.item-view-container');
                var $itemViewTabsContainer = $('.item-view-tabs-container');
                var maxHeightItemView = $itemViewContainer[0].clientHeight;

                var detailViewLeftPos = function () {
                    var result = (jqEl.offset().left);
                    if (result + $itemViewContainer[0].clientWidth > _tableBody[0].clientWidth) {
                        result = jqEl.offset().left - _tableBody[0].clientWidth / 2;
                    }
                    return result;
                }();
                var detailViewTopPos = function () {
                    var result = (jqEl.offset().top / 2) - _tableBody[0].clientHeight / 4;
                    return result;
                }();

                detailView.css({
                    display: 'block',
                    position: 'absolute',
                    'max-height': maxHeightItemView,
                    left: detailViewLeftPos,
                    top: detailViewTopPos
                });

                //check if the left tabs have more than 8 items, if so we need to add an overflow
                //along with changing the margin on the item view itself
                if ($itemViewTabsContainer[0].children.length > 8) {
                    $itemViewContainer.css({ 'margin-left': '53px' });
                    $itemViewTabsContainer.css({
                        'border-bottom': '1px solid black',
                        'overflow-y': 'auto',
                        'padding-right': '18px'
                    });
                } else {
                    $itemViewContainer.css({ 'margin-left': '35px' });
                }
            }
        }

        function getDetail(mediaItems, mediaItemIndex) {
            var media = mediaItems[mediaItemIndex];

            var $leftTabsMarkup;

            //if more than one item in this cell, we show a left counter to switch the details
            if (mediaItems.length > 1) {
                $leftTabsMarkup = $('<div class="item-view-tabs-container"></div>');
                for (var i = 0; i < mediaItems.length; i++) {
                    var $itemDiv = $('<div></div>', {
                        'class': i === mediaItemIndex ? 'item-view-tabs active' : 'item-view-tabs',
                        click: (function (index) {
                            return function () {
                                mediaClick.apply(_lastClickedTableCell, [mediaItems, index]);
                            }
                        })(i)
                    });

                    $itemDiv = $itemDiv.append($('<div></div>', {
                        class: 'vertical-center',
                        text: i + 1
                    }));

                    $leftTabsMarkup = $leftTabsMarkup.append($itemDiv);
                }
            }

            //the actually div for the detail view
            var $detailDiv = $(
                '<div class="item-view-container">' +
                    '<div class="row item-close-btn">' +
                        '<button><i class="fa fa-times"></i></button>' +
                    '</div>' +
                    '<div class="row item-title">' +
                        media.Title +
                    '</div>' +
                    '<div class="item-scroll-container">' +
                        '<div class="row item-date">' +
                            media.PublishDate.substring(0, media.PublishDate.indexOf('T')) +
                        '</div>' +
                        '<div class="row item-type">' +
                            media.SubTitle +
                        '</div>' +
                        '<div class="row item-asset">' +
                            (media.AssetDownloadLink ? '<a href="" target="_blank">Download asset</a>' : '') +
                        '</div>' +
                        '<div class="row item-description">' +
                            media.Description +
                        '</div>' +
                        '<div class="row item-image">' +
                            (media.ImageSrc ? '<img src=' + media.ImageSrc + '/>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '</div>');
            if (media.ImageSrc) {
                $detailDiv.find('.item-image>img').attr('src', media.ImageSrc);
            }
            if (media.AssetDownloadLink) {
                $detailDiv.find('.item-asset>a').attr('href', media.AssetDownloadLink);
            }

            //$result is a container for the left nav counter + detail view
            var $result = $('<div></div>', {
                id: 'itemDetail'
            })
            .css({ 'z-index': 10 })
            .append(($leftTabsMarkup || $('<div></div>'))
            .add($detailDiv))
            .draggable();

            //the X (close) button to remove the detail view
            $detailDiv.find("button").click(function () {
                $result.remove();
            });

            return $result;
        }

        function clearCalendar() {
            var tdList = $('#calendar-container .cell-data');
            for (var i = 0; i < tdList.length; i++) {
                tdList[i].remove();
            }

            var tdListCurrentMonth = $('#calendar-container .cell-table-container');
            for (var j = 0; j < tdListCurrentMonth.length; j++) {
                tdListCurrentMonth[j].remove();
            }
        }

        function getFilteredActivePlannedItems(items) {
            var result = {
                activeItems: [],
                plannedItems: []
            }
            items.forEach(function (item) {
                var itemDate = item.PublishDate;
                var d = new Date();
                var itemsDay = parseInt(itemDate.substring(8, itemDate.indexOf('T')));
                var itemsYear = parseInt(itemDate.substring(0, 4));
                if (itemsYear === d.getFullYear() && itemsDay < d.getDate()) {
                    result.activeItems.push(item);
                } else {
                    result.plannedItems.push(item);
                }
            });
            return result;
        }

        $('#backBtn').click(function (e) {
            e.preventDefault();
            _currentYear--;
            setQuerystring();
            $(this).parent().find('#txtCalendarYear').text(_currentYear);
            getPlannerSummary().then(function (data) {
                plotCalendar(data);
            });
        });

        $('#forwardBtn').click(function (e) {
            e.preventDefault();
            _currentYear++;
            setQuerystring();
            $(this).parent().find('#txtCalendarYear').text(_currentYear);
            getPlannerSummary().then(function (data) {
                plotCalendar(data);
            });
        });
    }
}(jQuery));

