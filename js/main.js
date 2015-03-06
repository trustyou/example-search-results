(function($, Mustache) {
	"use strict";

	/*
	This is the list of hotels that this example is based on. It is
	hardcoded here; in all real-life applications, these IDs and names
	would be a result of a query.
	*/
	var hotels = [
		{
			name: "Hotel Adlon Kempinski",
			tyId: "60fd56b6-8f61-4672-a1d3-d76ec6bcf540",
			image: "img/Hotel_Adlon_Kempinski.jpg"
		},
		{
			name: "The Mandala Hotel",
			tyId: "a6d7ac66-51ca-46b4-9a74-57324a2977b4",
			image: "img/The_Mandala_Hotel.jpg"
		},
		{
			name: "Das Stue",
			tyId: "359e1e4b-569a-4f97-aaa1-357f241a851b",
			image: "img/Das_Stue_Hotel.jpg"
		},
		{
			name: "Adina Apartment Hotel Berlin Hackescher Markt",
			tyId: "387d25e2-4321-4b45-a02a-e548a460383a",
			image: "img/Adina_Apartment_Hotel.jpg"
		},
		{
			name: "Regent Berlin",
			tyId: "07a403a9-cb62-4a20-a134-139b2eab7fdb",
			image: "img/Regent_Berlin.jpg"
		}
	];

	/*
	Prepare the request to the TrustYou API. We will make use of the Bulk
	API to launch several requests at once. Note how the language and
	version need to be passed with each individual request, but the
	mandatory API key need only be put once in the bulk request.
	*/
	var requestList = hotels.map(function(hotel) {
		/*
		When querying a JSON widget, always ask for the specific
		version you developed against. This guarantees that no schema-
		breaking changes will affect your code.
		*/
		return "/hotels/" + hotel.tyId + "/tops_flops.json?" + $.param({lang: "en", v: "5.23"});
	});
	// JSON-encode the request list
	requestList = JSON.stringify(requestList);

	var bulkRequest = $.ajax({
		url: "http://api.trustyou.com/bulk",
		data: {
			request_list: requestList,
			/*
			This is a demo API key, do not reuse it! Contact
			TrustYou to receive your own.
			*/
			key: "a06294d3-4d58-45c8-97a1-5c905922e03a"
		},
		// Usage of JSONP is not required for server-side calls
		dataType: "jsonp"
	}).fail(function() {
		throw "Bulk request failed!";
	});

	// when the DOM is ready for rendering, process the API response
	$(function() {
		bulkRequest.done(processApiResponse);
	});

	/**
	Render a recommended hotel.

	@param hotelData - Data for this hotel from your database, e.g. its name
	@param reviewSummary - TrustYou Review Summary API response
	*/
	function renderRecommendedHotel(hotelData, reviewSummary) {
		// load the HTML template
		var hotelTemplate = $("#tmpl-recommended-hotel").html();
		// prepare the data to be passed to the template
		var templateData = {
			name: hotelData.name,
			reviewsCount: reviewSummary["reviews_count"],
			trustScore: reviewSummary["summary"].score,
			popularity: reviewSummary["summary"].popularity,
			hotelTypes: [],
			image: hotelData.image
		};

		/*
		For recommended hotels, we will merely show the first (i.e.
		primary) hotel type.
		*/
		if (reviewSummary["hotel_type_list"].length > 0) {
			var hotelType = reviewSummary["hotel_type_list"][0];
			templateData.hotelTypes = [{
				categoryId: hotelType["category_id"],
				/*
				Texts in the "text" property contain markers
				in the form of <pos>..</pos>, <neg>..</neg> and
				<neu>..</neu>, which enclose passages in the
				text that contain sentiment. Either remove
				these before displaying the text, or replace
				them with meaningful markup, as is done here.
				*/
				text: hotelType["text"].replace("<pos>", "<strong>").replace("</pos>", "</strong>")
			}];
		}

		// render the template, and display the hotel
		var hotelRendered = Mustache.render(hotelTemplate, templateData);
		$("#recommendedHotels").append(hotelRendered);
	}

	/**
	Render a result list hotel.

	@param hotelData - Data for this hotel from your database, e.g. its name
	@param reviewSummary - TrustYou Review Summary API response
	*/
	function renderHotel(hotelData, reviewSummary) {
		// load the HTML template
		var hotelTemplate = $("#tmpl-hotel").html();
		// prepare the data to be passed to the template
		var templateData = {
			name: hotelData.name,
			reviewsCount: reviewSummary["reviews_count"],
			trustScore: reviewSummary["summary"].score,
			highlights: [],
			image: hotelData.image
		};

		/*
		When displaying several hotels on a result list page, it is
		usually a bit boring to show the most frequent categories with
		each hotel. People will always talk about location, service and
		room a lot, and it is repetitive to see "great location"
		several times.

		Instead, we will use the "relevance" property, which is
		provided by TrustYou to find categories which set a hotel apart
		from other comparable hotels.

		Additionally, instead of a generic category name like "Great
		Location", we will use content from the "highlight_list"
		property. Highlights are quotes from actual customer reviews,
		which are much more unique and specific to the hotel, e.g.
		"Right next to Brandenburg gate".
		*/

		// Aggregate all categories into one list! Start with top-level categories ...
		var categories = reviewSummary.category_list;
		// ... add all of their sub categories ...
		reviewSummary["category_list"].forEach(function(category) {
			categories = categories.concat(category["sub_category_list"]);
		});
		// ... and all good to know categories
		categories = categories.concat(reviewSummary["good_to_know_list"]);
		// ... and finally sort by relevance
		var relevantCategories = categories.sort(function(catA, catB) {
			return catB["relevance"] - catA["relevance"];
		});

		// from each category, add one highlight
		var highlights = [], highlight;
		relevantCategories.forEach(function(category) {
			if (category["highlight_list"].length > 0) {
				/*
				If there are highlights for this category, pick
				the first one.
				*/
				highlight = category["highlight_list"][0]["text"];
			} else {
				/*
				It is possible that no highlights are returned
				for some categories and rare languages, e.g.
				Thai. For such cases, we recommend to use the
				"short_text" property, which is guaranteed to
				be present for all categories and languages.
				*/
				highlight = category["short_text"];
			}
			/*
			Note that highlights can repeat in different
			categories, so we have to check if the text is present
			already before adding.
			*/
			if (highlights.indexOf(highlight) === -1) {
				highlights.push(highlight);
			}
		});
		// take the top three highlights
		templateData.highlights = highlights.slice(0, 3).map(function(highlight) {
			return {
				text: highlight
			};
		});

		// render the template, and display the hotel
		var hotelRendered = Mustache.render(hotelTemplate, templateData);
		$("#hotels").append(hotelRendered);
	}

	/**
	Process a response from the TrustYou Bulk API.
	*/
	function processApiResponse(data) {
		// check whether the bulk request was successful
		if (data.meta.code !== 200) {
			throw "Bulk request failed!";
		}
		// go through all responses, and render each hotel
		var responses = data.response.response_list;
		responses.forEach(function(response, index) {
			// check whether the individual request was successful
			if (response.meta.code !== 200) {
				throw "Request failed!";
			}
			/*
			Results are guaranteed to be in the same order as the
			request_list we passed earlier, so we can merge the
			response with our data by their index
			*/
			var hotelData = hotels[index];
			var reviewSummary = response.response;
			if (index < 2) {
				/*
				For illustration purposes, the first two hotels
				are treated as "featured" hotels, and presented
				differently.
				*/
				renderRecommendedHotel(hotelData, reviewSummary);
			} else {
				renderHotel(hotelData, reviewSummary);
			}
		});
	}

})($, Mustache);
